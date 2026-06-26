const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = [];
let naturezasVinculadasNoPainel = [];
let ordemFicticiaAoArrastar = 10;
let sortableInstance = null;
let sortableCamposInstance = null;

// Estados de controle local novos
let modoEdicaoAtivo = false;
let idSendoEditado = null;

window.onload = async () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
        const btn = document.getElementById("btnTema");
        if (btn) btn.textContent = "Modo Claro";
    }

    await carregarCategoriasDoBanco();
    await baixarEGuardarTodasAsNaturezas();

    const selectNatureza = document.getElementById("natureza");
    selectNatureza.addEventListener("change", (e) => {
        if (e.target.value !== "") {
            const primeiraOpcao = e.target.options[0];
            if (primeiraOpcao && primeiraOpcao.value === "") primeiraOpcao.remove();
            document.getElementById("areaBotaoNovaOpcao").style.display = "inline-block";
        } else {
            document.getElementById("areaBotaoNovaOpcao").style.display = "none";
            fecharFormCriarOpcao();
        }
        atualizarCamposDoBanco();
    });

    const grid = document.getElementById("zonaPreviewArrastavel");
    sortableInstance = new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function () {
            recalcularOrdemPorPosicaoFisica();
        }
    });

    // Inicializa reordenador físico dos campos em Modo Edição
    const containerCampos = document.getElementById("camposDinamicos");
    sortableCamposInstance = new Sortable(containerCampos, {
        animation: 150,
        handle: '.input-group-dinamico',
        disabled: true, // Desativado por padrão, só ativa no Modo Edição
        onEnd: function () {
            console.log("Campos reordenados visualmente na página.");
        }
    });

    ajustarAlturaTextarea(document.getElementById("resultado"));
};

let timeout;
function atualizarTudo() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        verificarRegrasOcultamento(); // Processa dependências "Oculto Até"
        calcularProbabilidadesDoBanco();
        gerarTextoDoBanco();
        ajustarAlturaTextarea(document.getElementById("resultado"));
    }, 200);
}

function alternarTema() {
    const typeofTheme = document.body.getAttribute("data-theme");
    const botao = document.getElementById("btnTema");
    if (typeofTheme === "dark") {
        document.body.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
        if (botao) botao.textContent = "Modo Noturno";
    } else {
        document.body.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
        if (botao) botao.textContent = "Modo Claro";
    }
}

function alternarModoEdicao() {
    modoEdicaoAtivo = !modoEdicaoAtivo;
    const btn = document.getElementById("btnModoEdicao");
    const container = document.getElementById("camposDinamicos");

    if (modoEdicaoAtivo) {
        btn.textContent = "⚙️ Modo Edição: ON";
        btn.style.backgroundColor = "orange";
        btn.style.color = "black";
        container.classList.add("modo-edicao-ativo");
        sortableCamposInstance.option("disabled", false);
        alert("Modo Edição Ativado! Clique no título de qualquer opção abaixo para editar seu texto/prioridade ou arraste os blocos inteiros para reordenar a página.");
    } else {
        btn.textContent = "⚙️ Modo Edição: OFF";
        btn.style.backgroundColor = "";
        btn.style.color = "";
        container.classList.remove("modo-edicao-ativo");
        sortableCamposInstance.option("disabled", true);
    }
}

function ajustarAlturaTextarea(elemento) {
    if (!elemento) return;
    elemento.style.height = "auto";
    elemento.style.height = elemento.scrollHeight + "px";
}

function gerarId(nome) {
    return "campo_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function configurarFluxoRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    const container = document.getElementById("containerPassosDinamicos");
    const labelNome = document.getElementById("labelNomeCampoGeral");
    const inputNome = document.getElementById("regNomeCampo");
    const dicaPlaceholder = document.getElementById("dicaPlaceholder");
    const blocoRegraMaiorQue = document.getElementById("blocoRegraMaiorQue");

    if (!tipo) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";
    document.getElementById("blocoSubtipoDropdown").style.display = "none";
    document.getElementById("blocoNomeDropdownNovo").style.display = "none";
    document.getElementById("blocoDropdownExistente").style.display = "none";
    document.getElementById("blocoNomeCampoGeral").style.display = "block";
    dicaPlaceholder.style.display = "none";
    blocoRegraMaiorQue.style.display = "none";

    if (tipo === "bool") {
        labelNome.textContent = "Nome/Título da Opção (Toggle):";
        inputNome.placeholder = "Ex: Com fone conectado";
    } else if (tipo === "integer") {
        labelNome.textContent = "Nome/Título da Opção (Integer):";
        inputNome.placeholder = "Ex: Quantidade de suspeitos";
        dicaPlaceholder.textContent = "Use {valor} para onde entrará o número.";
        dicaPlaceholder.style.display = "block";
        blocoRegraMaiorQue.style.display = "block"; // Ativa regra maior que para integer
    } else if (tipo === "inputfield") {
        labelNome.textContent = "Nome/Título do Campo (Inputfield):";
        inputNome.placeholder = "Ex: Nome da Rua";
        dicaPlaceholder.textContent = "Use {valor} para onde entrará o texto.";
        dicaPlaceholder.style.display = "block";
    } else if (tipo === "dropdown") {
        document.getElementById("blocoSubtipoDropdown").style.display = "block";
        configurarSubtipoDropdown();
    }
    carregarDropdownOcultoAte();
    atualizarPreviewInline();
}

function configurarSubtipoDropdown() {
    const sub = document.getElementById("regSubtipoDropdown").value;
    const labelNome = document.getElementById("labelNomeCampoGeral");
    const inputNome = document.getElementById("regNomeCampo");

    if (sub === "novo") {
        document.getElementById("blocoNomeDropdownNovo").style.display = "block";
        document.getElementById("blocoDropdownExistente").style.display = "none";
        labelNome.textContent = "Primeira Opção deste Dropdown:";
        inputNome.placeholder = "Ex: Faca de Cozinha";
    } else {
        document.getElementById("blocoNomeDropdownNovo").style.display = "none";
        document.getElementById("blocoDropdownExistente").style.display = "block";
        labelNome.textContent = "Título / Nova Opção Selecionável:";
        inputNome.placeholder = "Ex: Revólver Calibre 38";
        atualizarDropdownsExistentesDaCategoriaInline();
    }
    atualizarPreviewInline();
}

function carregarDropdownOcultoAte() {
    const select = document.getElementById("regOcultoAte");
    select.innerHTML = '<option value="">Sempre Visível</option>';
    perguntasDaCategoriaAtual.forEach(p => {
        if (idSendoEditado && p.id === idSendoEditado) return;
        const opt = document.createElement("option");
        opt.value = p.nome_campo;
        opt.textContent = `Apenas se "${p.nome_campo}" ativo`;
        select.appendChild(opt);
    });
}

function atualizarCamposDuranteCriacaoLocal() {
    atualizarPreviewInline();
}

function verificarRegrasOcultamento() {
    perguntasDaCategoriaAtual.forEach(campo => {
        const idCampoTarget = gerarId(campo.nome_campo);
        const elementoDOM = document.getElementById(idCampoTarget)?.closest('.input-group-dinamico');

        if (elementoDOM && campo.oculto_ate) {
            const idOrigemDep = gerarId(campo.oculto_ate);
            const elementoOrigem = document.getElementById(idOrigemDep);

            let condicaoAtendida = false;
            if (elementoOrigem) {
                if (elementoOrigem.type === "checkbox" && elementoOrigem.checked) condicaoAtendida = true;
                if ((elementoOrigem.type === "text" || elementoOrigem.tagName === "SELECT") && elementoOrigem.value !== "") condicaoAtendida = true;
                if (elementoOrigem.type === "number" && elementoOrigem.value !== "") condicaoAtendida = true;
            }

            elementoDOM.style.display = condicaoAtendida ? "block" : "none";
        }
    });
}

function exibirFormCriarCategoria() { document.getElementById("areaCriarCategoria").style.display = "block"; }
function fecharFormCriarCategoria() {
    document.getElementById("areaCriarCategoria").style.display = "none";
    document.getElementById("newCatNome").value = "";
}

function exibirFormCriarOpcao() {
    idSendoEditado = null;
    document.getElementById("tituloFormOpcao").textContent = "📝 Registrar Opção / Pergunta";
    document.getElementById("btnSalvarRegistro").textContent = "Salvar Registro no Banco";
    document.getElementById("areaCriarOpcao").style.display = "block";
    document.getElementById("regTipoCampo").value = "";
    document.getElementById("containerPassosDinamicos").style.display = "none";
    document.getElementById("regQuebraLinha").checked = false;
    document.getElementById("regValorMaiorQue").value = "";
    configurarFluxoRegistro();
}

function fecharFormCriarOpcao() {
    document.getElementById("areaCriarOpcao").style.display = "none";
    document.getElementById("regNomeCampo").value = "";
    document.getElementById("regTextoOutput").value = "";
    document.getElementById("regNomeDropdownNovo").value = "";
    document.getElementById("regTipoCampo").value = "";
    document.getElementById("regQuebraLinha").checked = false;
    document.getElementById("regValorMaiorQue").value = "";
    idSendoEditado = null;
    naturezasVinculadasNoPainel = [];
    renderizarTagsNaturezas();
    atualizarTudo();
}

function iniciarEdicaoDeCampo(campoId) {
    const campo = perguntasDaCategoriaAtual.find(p => p.id === campoId);
    if (!campo) return;

    idSendoEditado = campoId;
    document.getElementById("tituloFormOpcao").textContent = `⚙️ Editando: ${campo.nome_campo}`;
    document.getElementById("btnSalvarRegistro").textContent = "Atualizar Alterações";
    document.getElementById("areaCriarOpcao").style.display = "block";

    let tipoForm = "bool";
    if (campo.tipo_campo === "numero") tipoForm = "integer";
    if (campo.tipo_campo === "texto") tipoForm = "inputfield";
    if (campo.tipo_campo === "dropdown") tipoForm = "dropdown";

    document.getElementById("regTipoCampo").value = tipoForm;
    configurarFluxoRegistro();

    document.getElementById("regNomeCampo").value = campo.nome_campo;

    if (tipoForm === "integer") {
        document.getElementById("regTextoOutput").value = campo.texto_output_numero || "";
        document.getElementById("regValorMaiorQue").value = campo.regra_maior_que || "";
    } else if (tipoForm === "dropdown") {
        document.getElementById("regSubtipoDropdown").value = "novo";
        configurarSubtipoDropdown();
        if (campo.opcoes_dropdown && campo.opcoes_dropdown.length > 0) {
            document.getElementById("regNomeCampo").value = campo.opcoes_dropdown[0].valor_opcao;
            document.getElementById("regTextoOutput").value = campo.opcoes_dropdown[0].texto_output || "";
        }
    } else {
        document.getElementById("regTextoOutput").value = campo.texto_output_true || "";
    }

    document.getElementById("regOcultoAte").value = campo.oculto_ate || "";
    document.getElementById("regQuebraLinha").checked = campo.forcar_quebra_linha || false;

    atualizarPreviewInline();
}

function atualizarPreviewInline() {
    const grid = document.getElementById("zonaPreviewArrastavel");
    let textoDigitado = document.getElementById("regTextoOutput").value.trim() || "(Frase do registro atual)";

    if (document.getElementById("regQuebraLinha").checked) {
        textoDigitado = "↩ " + textoDigitado;
    }

    grid.innerHTML = "";

    perguntasDaCategoriaAtual.forEach(p => {
        if (idSendoEditado && p.id === idSendoEditado) return;

        let textoExistente = "";
        if (p.tipo_campo === 'bool' || p.tipo_campo === 'texto') textoExistente = p.texto_output_true;
        if (p.tipo_campo === 'numero') textoExistente = p.texto_output_numero;
        if (p.tipo_campo === 'dropdown' && p.opcoes_dropdown && p.opcoes_dropdown.length > 0) {
            textoExistente = p.opcoes_dropdown[0].texto_output;
        }

        if (textoExistente) {
            const bloco = document.createElement("div");
            bloco.className = "bloco-frase-arrastavel";
            bloco.textContent = (p.forcar_quebra_linha ? "↩ " : "") + textoExistente.replace("{valor}", "[Exemplo]");
            grid.appendChild(bloco);
        }
    });

    const blocoCriacao = document.createElement("div");
    blocoCriacao.className = "bloco-frase-arrastavel item-criacao";
    blocoCriacao.id = "item_criacao_direta";
    blocoCriacao.textContent = textoDigitado.replace("{valor}", "[Valor]");
    grid.appendChild(blocoCriacao);

    recalcularOrdemPorPosicaoFisica();
}

function recalcularOrdemPorPosicaoFisica() {
    const blocos = [...document.querySelectorAll("#zonaPreviewArrastavel .bloco-frase-arrastavel")];
    let indexCriacao = blocos.findIndex(b => b.id === "item_criacao_direta");
    ordemFicticiaAoArrastar = indexCriacao !== -1 ? (indexCriacao + 1) * 10 : 10;
}

async function atualizarDropdownsExistentesDaCategoriaInline() {
    const catId = document.getElementById("natureza").value;
    const selectDropdownsMap = document.getElementById("regDropdownMae");
    selectDropdownsMap.innerHTML = '<option value="">Carregando...</option>';
    if (!catId) return;
    try {
        let { data } = await supabaseClient.from('perguntas').select('id, nome_campo').eq('categoria_id', catId).eq('tipo_campo', 'dropdown');
        selectDropdownsMap.innerHTML = '<option value="">Escolha o grupo...</option>';
        if (data) {
            data.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.nome_campo;
                selectDropdownsMap.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

async function salvarNovaCategoriaBanco() {
    const nomeCat = document.getElementById("newCatNome").value.trim();
    if (!nomeCat) { alert("Digite o nome da categoria!"); return; }
    try {
        const { error } = await supabaseClient.from('categorias').insert([{ nome: nomeCat }]);
        if (error) throw error;
        alert("Categoria adicionada com sucesso!");
        fecharFormCriarCategoria();
        await carregarCategoriasDoBanco();
    } catch (e) { alert("Erro ao salvar categoria."); }
}

async function salvarNovoRegistroInline() {
    const colaborador = "Atendente Autenticado";
    const categoriaId = document.getElementById("natureza").value;
    const tipoCampo = document.getElementById("regTipoCampo").value;
    const textoOutput = document.getElementById("regTextoOutput").value.trim();
    const ocultoAteVal = document.getElementById("regOcultoAte").value || null;
    const quebraLinhaVal = document.getElementById("regQuebraLinha").checked;
    const maiorQueVal = document.getElementById("regValorMaiorQue").value ? parseInt(document.getElementById("regValorMaiorQue").value) : null;
    const ordemFinal = ordemFicticiaAoArrastar;
    let nomeCampo = document.getElementById("regNomeCampo").value.trim();

    if (tipoCampo === 'dropdown' && document.getElementById("regSubtipoDropdown").value === 'novo') {
        nomeCampo = document.getElementById("regNomeDropdownNovo").value.trim();
    }

    if (!categoriaId || !nomeCampo || !textoOutput) {
        alert("Preencha todos os campos obrigatórios para salvar!");
        return;
    }

    try {
        // Fluxo de Atualização se estive editando
        if (idSendoEditado) {
            const dbTipo = tipoCampo === 'integer' ? 'numero' : (tipoCampo === 'inputfield' ? 'texto' : 'bool');

            await supabaseClient.from('perguntas').update({
                nome_campo: nomeCampo,
                tipo_campo: dbTipo,
                texto_output_true: dbTipo !== 'numero' ? textoOutput : null,
                texto_output_numero: dbTipo === 'numero' ? textoOutput : null,
                ordem_contexto_true: ordemFinal,
                ordem_contexto_numero: ordemFinal,
                oculto_ate: ocultoAteVal,
                forcar_quebra_linha: quebraLinhaVal,
                regra_maior_que: maiorQueVal
            }).eq('id', idSendoEditado);

            alert("Registro atualizado com sucesso!");
            fecharFormCriarOpcao();
            await atualizarCamposDoBanco();
            return;
        }

        // Fluxo normal de inserção (novo registro)
        if (tipoCampo === 'bool' || tipoCampo === 'integer' || tipoCampo === 'inputfield') {
            const dbTipo = tipoCampo === 'integer' ? 'numero' : (tipoCampo === 'inputfield' ? 'texto' : 'bool');

            const { data: novaPerg, error: err } = await supabaseClient.from('perguntas').insert([{
                categoria_id: categoriaId,
                nome_campo: nomeCampo,
                tipo_campo: dbTipo,
                texto_output_true: dbTipo !== 'numero' ? textoOutput : null,
                ordem_contexto_true: dbTipo !== 'numero' ? ordemFinal : null,
                texto_output_numero: dbTipo === 'numero' ? textoOutput : null,
                ordem_contexto_numero: dbTipo === 'numero' ? ordemFinal : null,
                ordem_exibicao: 10,
                registrado_por: colaborador,
                oculto_ate: ocultoAteVal,
                forcar_quebra_linha: quebraLinhaVal,
                regra_maior_que: maiorQueVal
            }]).select();

            if (err) throw err;

            if (naturezasVinculadasNoPainel.length > 0) {
                const inserts = naturezasVinculadasNoPainel.map(nId => ({ pergunta_id: novaPerg[0].id, natureza_id: nId }));
                await supabaseClient.from('vinculos_pesos').insert(inserts);
            }
        } else if (tipoCampo === 'dropdown') {
            const sub = document.getElementById("regSubtipoDropdown").value;
            if (sub === 'novo') {
                const valorInicial = document.getElementById("regNomeCampo").value.trim() || "Padrão";
                const { data: novaPerg, error: err } = await supabaseClient.from('perguntas').insert([{
                    categoria_id: categoriaId,
                    nome_campo: nomeCampo,
                    tipo_campo: 'dropdown',
                    ordem_exibicao: 10,
                    registrado_por: colaborador,
                    oculto_ate: ocultoAteVal,
                    forcar_quebra_linha: quebraLinhaVal
                }]).select();

                if (err) throw err;

                const { data: novaOpt } = await supabaseClient.from('opcoes_dropdown').insert([{
                    pergunta_id: novaPerg[0].id,
                    valor_opcao: valorInicial,
                    texto_output: textoOutput,
                    ordem_contexto: ordemFinal,
                    registrado_por: colaborador
                }]).select();

                if (naturezasVinculadasNoPainel.length > 0) {
                    const inserts = naturezasVinculadasNoPainel.map(nId => ({ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }));
                    await supabaseClient.from('vinculos_pesos').insert(inserts);
                }
            } else {
                const perguntaIdMae = document.getElementById("regDropdownMae").value;
                if (!perguntaIdMae) { alert("Selecione o dropdown alvo!"); return; }

                const { data: novaOpt, error: err } = await supabaseClient.from('opcoes_dropdown').insert([{
                    pergunta_id: perguntaIdMae,
                    valor_opcao: nomeCampo,
                    texto_output: textoOutput,
                    ordem_contexto: ordemFinal,
                    registrado_por: colaborador
                }]).select();

                if (err) throw err;

                if (naturezasVinculadasNoPainel.length > 0) {
                    const inserts = naturezasVinculadasNoPainel.map(nId => ({ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }));
                    await supabaseClient.from('vinculos_pesos').insert(inserts);
                }
            }
        }

        alert("Opção salva com sucesso!");
        fecharFormCriarOpcao();
        await atualizarCamposDoBanco();
    } catch (e) { console.error(e); }
}

async function baixarEGuardarTodasAsNaturezas() {
    try {
        let { data } = await supabaseClient.from('naturezas_copom').select('id, natureza');
        listaMapeadaNaturezasCopom = data || [];
    } catch (err) { console.error(err); }
}

function filtrarNaturezasAutocomplete(termoBusca) {
    const painel = document.getElementById("painelSugestoesInstantes");
    if (!termoBusca || termoBusca.trim().length < 1) { painel.style.display = "none"; return; }
    const termoLimpo = termoBusca.toUpperCase();
    const filtradas = listaMapeadaNaturezasCopom.filter(nat => nat.natureza && nat.natureza.toUpperCase().includes(termoLimpo));

    painel.innerHTML = "";
    if (filtradas.length === 0) {
        painel.innerHTML = '<div class="item-sugestao">Nenhuma correspondência...</div>';
    } else {
        filtradas.slice(0, 10).forEach(nat => {
            const div = document.createElement("div");
            div.className = "item-sugestao";
            div.textContent = nat.natureza;
            div.onclick = () => {
                document.getElementById("painelSugestoesInstantes").style.display = "none";
                document.getElementById("buscaNatureza").value = "";
                if (!naturezasVinculadasNoPainel.includes(nat.id)) {
                    naturezasVinculadasNoPainel.push(nat.id);
                    renderizarTagsNaturezas();
                }
            };
            painel.appendChild(div);
        });
    }
    painel.style.display = "block";
}

function renderizarTagsNaturezas() {
    const ul = document.getElementById("listaNaturezasVinculadas");
    ul.innerHTML = "";
    naturezasVinculadasNoPainel.forEach(id => {
        const natObj = listaMapeadaNaturezasCopom.find(n => n.id === id);
        if (natObj) {
            const li = document.createElement("li");
            li.innerHTML = `${natObj.natureza} <button class="btn-remover-tag" onclick="naturezasVinculadasNoPainel=naturezasVinculadasNoPainel.filter(nId=>nId!==${id});renderizarTagsNaturezas();">&times;</button>`;
            ul.appendChild(li);
        }
    });
}

async function carregarCategoriasDoBanco() {
    try {
        let { data } = await supabaseClient.from('categorias').select('*').order('id', { ascending: true });
        dadosNaturezas = data || [];
        const selectPrincipal = document.getElementById("natureza");
        selectPrincipal.innerHTML = '<option value="">Selecione a Categoria...</option>';
        dadosNaturezas.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.nome;
            selectPrincipal.appendChild(option);
        });
    } catch (erro) { console.error(erro); }
}

async function atualizarCamposDoBanco() {
    const categoryId = document.getElementById("natureza").value;
    const container = document.getElementById("camposDinamicos");
    container.innerHTML = "";
    document.getElementById("painelSugestoes").style.display = "none";
    document.getElementById("resultado").value = "";

    if (!categoryId) { perguntasDaCategoriaAtual = []; return; }

    try {
        let { data: perguntas } = await supabaseClient.from('perguntas').select('*').eq('categoria_id', categoryId).order('id', { ascending: true });
        perguntasDaCategoriaAtual = perguntas || [];

        for (let campo of perguntasDaCategoriaAtual) {
            if (campo.tipo_campo === "dropdown") {
                let { data: opcoes } = await supabaseClient.from('opcoes_dropdown').select('*').eq('pergunta_id', campo.id);
                campo.opcoes_dropdown = opcoes || [];
            }
            let { data: vPesos } = await supabaseClient.from('vinculos_pesos').select('natureza_id, naturezas_copom(natureza)').eq('pergunta_id', campo.id);
            campo.vinculos_pesos = vPesos || [];

            if (campo.opcoes_dropdown) {
                for (let opt of campo.opcoes_dropdown) {
                    let { data: vOptPesos } = await supabaseClient.from('vinculos_pesos').select('natureza_id, naturezas_copom(natureza)').eq('opcao_dropdown_id', opt.id);
                    opt.vinculos_pesos = vOptPesos || [];
                }
            }

            const divGroup = document.createElement("div");
            divGroup.className = "input-group-dinamico";
            divGroup.setAttribute("data-id", campo.id); // Guardado para rastrear ordenações físicas

            const id = gerarId(campo.nome_campo);
            const labelContainer = document.createElement("div");
            labelContainer.className = "header-container-opcao";

            const label = document.createElement("label");
            label.innerHTML = `<span>${campo.nome_campo}</span>`;
            label.htmlFor = id;
            label.style.cursor = "pointer";

            // Evento de gatilho para o botão EDITAR via clique no título do campo
            label.onclick = () => {
                iniciarEdicaoDeCampo(campo.id);
            };

            labelContainer.appendChild(label);
            divGroup.appendChild(labelContainer);

            if (campo.tipo_campo === "dropdown") {
                const select = document.createElement("select");
                select.id = id;
                select.innerHTML = '<option value="">Selecione...</option>';
                if (campo.opcoes_dropdown) {
                    campo.opcoes_dropdown.forEach(opcao => {
                        const option = document.createElement("option");
                        option.value = opcao.valor_opcao;
                        option.textContent = opcao.valor_opcao;
                        select.appendChild(option);
                    });
                }
                select.addEventListener("change", () => { atualizarTudo(); });
                divGroup.appendChild(select);
            }

            if (campo.tipo_campo === "bool") {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = id;
                checkbox.style.width = "auto";
                checkbox.style.marginLeft = "10px";
                checkbox.addEventListener("change", atualizarTudo);
                divGroup.appendChild(checkbox);
            }

            if (campo.tipo_campo === "numero" || campo.tipo_campo === "texto") {
                const input = document.createElement("input");
                input.type = campo.tipo_campo === "numero" ? "number" : "text";
                input.id = id;
                input.addEventListener("input", atualizarTudo);
                divGroup.appendChild(input);
            }
            container.appendChild(divGroup);
        }
        verificarRegrasOcultamento();
    } catch (erro) { console.error(erro); }
}

function calcularProbabilidadesDoBanco() {
    if (!perguntasDaCategoriaAtual.length) return;
    let arrayVotosNaturezas = [];

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.vinculos_pesos) {
                opt.vinculos_pesos.forEach(v => { if (v.naturezas_copom?.natureza) arrayVotosNaturezas.push(v.naturezas_copom.natureza); });
            }
        }
        if (campo.tipo_campo === "bool" && el.checked) {
            campo.vinculos_pesos?.forEach(v => { if (v.naturezas_copom?.natureza) arrayVotosNaturezas.push(v.naturezas_copom.natureza); });
        }
        if ((campo.tipo_campo === "numero" || campo.tipo_campo === "texto") && el.value.trim() !== "") {
            // RECURSO CONDICIONAL PARA INTEGER (MAIOR QUE X)
            if (campo.tipo_campo === "numero" && campo.regra_maior_que !== null) {
                const valorDigitado = parseInt(el.value.trim());
                if (valorDigitado <= campo.regra_maior_que) {
                    return; // Aborta contagem de voto se não atingir critério maior que X
                }
            }
            campo.vinculos_pesos?.forEach(v => { if (v.naturezas_copom?.natureza) arrayVotosNaturezas.push(v.naturezas_copom.natureza); });
        }
    });

    const painelSugestoes = document.getElementById("painelSugestoes");
    const listaSugestoes = document.getElementById("listaSugestoes");
    listaSugestoes.innerHTML = "";

    if (arrayVotosNaturezas.length === 0) {
        painelSugestoes.style.display = "none";
        return;
    }

    const contagem = {};
    arrayVotosNaturezas.forEach(x => { contagem[x] = (contagem[x] || 0) + 1; });
    const ordenadas = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);

    ordenadas.slice(0, 3).forEach(nat => {
        const li = document.createElement("li");
        li.textContent = `${nat} (${contagem[nat]} correspondência(s))`;
        listaSugestoes.appendChild(li);
    });
    painelSugestoes.style.display = "block";
}

function gerarTextoDoBanco() {
    let listagemFrasesFinais = [];

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        // Verifica se o campo pai está oculto por regra condicional antes de emitir texto
        const blocoDOM = el.closest('.input-group-dinamico');
        if (blocoDOM && blocoDOM.style.display === "none") return;

        if (campo.tipo_campo === "bool" && el.checked && campo.texto_output_true) {
            listagemFrasesFinais.push({
                texto: campo.texto_output_true,
                ordem: campo.ordem_contexto_true || 10,
                quebra: campo.forcar_quebra_linha || false
            });
        }
        else if (campo.tipo_campo === "numero" && el.value.trim() !== "" && campo.texto_output_numero) {
            let tratado = campo.texto_output_numero.replace("{valor}", el.value.trim());
            listagemFrasesFinais.push({
                texto: tratado,
                ordem: campo.ordem_contexto_numero || 10,
                quebra: campo.forcar_quebra_linha || false
            });
        }
        else if (campo.tipo_campo === "texto" && el.value.trim() !== "" && campo.texto_output_true) {
            let tratado = campo.texto_output_true.replace("{valor}", el.value.trim().toUpperCase());
            listagemFrasesFinais.push({
                texto: tratado,
                ordem: campo.ordem_contexto_true || 10,
                quebra: campo.forcar_quebra_linha || false
            });
        }
        else if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.texto_output) {
                listagemFrasesFinais.push({
                    texto: opt.texto_output,
                    ordem: opt.ordem_contexto || 10,
                    quebra: campo.forcar_quebra_linha || false
                });
            }
        }
    });

    listagemFrasesFinais.sort((a, b) => a.ordem - b.ordem);

    // Compilação tratando as Quebras de Linha (\n) determinadas via painel
    let stringFinalCompilada = "";
    listagemFrasesFinais.forEach((f, idx) => {
        if (f.quebra && idx > 0) {
            stringFinalCompilada += "\n" + f.texto;
        } else {
            stringFinalCompilada += (stringFinalCompilada === "" ? "" : " ") + f.texto;
        }
    });

    document.getElementById("resultado").value = stringFinalCompilada;
}

function copiarTexto() {
    const area = document.getElementById("resultado");
    if (!area.value) return;
    navigator.clipboard.writeText(area.value);
    const toast = document.getElementById("toastCopia");
    toast.classList.add("visivel");
    setTimeout(() => toast.classList.remove("visivel"), 2000);
}

function limparPagina() {
    const inputs = document.querySelectorAll("#camposDinamicos input, #camposDinamicos select");
    inputs.forEach(i => {
        if (i.type === "checkbox") i.checked = false;
        else i.value = "";
    });
    atualizarTudo();
}