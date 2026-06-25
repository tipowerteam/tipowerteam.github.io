const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = [];
let naturezasVinculadasNoPainel = [];
let ordemFicticiaAoArrastar = 10;
let sortableInstance = null;

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
            document.getElementById("areaBotaoNovaOpcao").style.display = "block";
        } else {
            document.getElementById("areaBotaoNovaOpcao").style.display = "none";
            fecharFormCriarOpcao();
        }
        atualizarCamposDoBanco();
    });

    // Inicializa o SortableJS na Zona de Arrastar do Formulário
    const grid = document.getElementById("zonaPreviewArrastavel");
    sortableInstance = new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function () {
            recalcularOrdemPorPosicaoFisica();
        }
    });
};

let timeout;
function atualizarTudo() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        calcularProbabilidadesDoBanco();
        gerarTextoDoBanco();
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

function gerarId(nome) {
    return "campo_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// CONTROLADORES DO NOVO FLUXO DE REGISTRO CONDICIONAL
function configurarFluxoRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    const container = document.getElementById("containerPassosDinamicos");
    const labelNome = document.getElementById("labelNomeCampoGeral");
    const inputNome = document.getElementById("regNomeCampo");
    const dicaPlaceholder = document.getElementById("dicaPlaceholder");

    if (!tipo) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";

    // Reset de visibilidade padrão dos blocos internos
    document.getElementById("blocoSubtipoDropdown").style.display = "none";
    document.getElementById("blocoNomeDropdownNovo").style.display = "none";
    document.getElementById("blocoDropdownExistente").style.display = "none";
    document.getElementById("blocoNomeCampoGeral").style.display = "block";
    dicaPlaceholder.style.display = "none";

    if (tipo === "bool") {
        labelNome.textContent = "Nome/Título da Opção (Toggle):";
        inputNome.placeholder = "Ex: Com fone conectado";
    } else if (tipo === "integer") {
        labelNome.textContent = "Nome/Título da Opção (Integer):";
        inputNome.placeholder = "Ex: Quantidade de suspeitos";
        dicaPlaceholder.textContent = "Use {valor} para onde entrará o número. Ex: DESPACHO: SOLICITANTE INFORMA TER APROXIMADAMENTE {valor} NO LOCAL";
        dicaPlaceholder.style.display = "block";
    } else if (tipo === "inputfield") {
        labelNome.textContent = "Nome/Título do Campo (Inputfield):";
        inputNome.placeholder = "Ex: Nome da Rua";
        dicaPlaceholder.textContent = "Use {valor} para onde entrará o texto. Ex: DESPACHO: SOLICITANTE INFORMA QUE ESTÁ SE DESLOCANDO ATÉ A {valor}";
        dicaPlaceholder.style.display = "block";
    } else if (tipo === "dropdown") {
        document.getElementById("blocoSubtipoDropdown").style.display = "block";
        configurarSubtipoDropdown();
    }
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

function exibirFormCriarCategoria() { document.getElementById("areaCriarCategoria").style.display = "block"; }
function fecharFormCriarCategoria() {
    document.getElementById("areaCriarCategoria").style.display = "none";
    document.getElementById("newCatNome").value = "";
}

function exibirFormCriarOpcao() {
    document.getElementById("areaCriarOpcao").style.display = "block";
    document.getElementById("regTipoCampo").value = "";
    document.getElementById("containerPassosDinamicos").style.display = "none";
    atualizarPreviewInline();
}

function fecharFormCriarOpcao() {
    document.getElementById("areaCriarOpcao").style.display = "none";
    document.getElementById("regNomeCampo").value = "";
    document.getElementById("regTextoOutput").value = "";
    document.getElementById("regNomeDropdownNovo").value = "";
    document.getElementById("regTipoCampo").value = "";
    naturezasVinculadasNoPainel = [];
    renderizarTagsNaturezas();
    atualizarTudo();
}

function abrirAtalhoDropdownExistente(perguntaId) {
    exibirFormCriarOpcao();
    document.getElementById("regTipoCampo").value = "dropdown";
    configurarFluxoRegistro();
    document.getElementById("regSubtipoDropdown").value = "existente";
    configurarSubtipoDropdown();
    setTimeout(() => { document.getElementById("regDropdownMae").value = perguntaId; atualizarPreviewInline(); }, 300);
}

// CONSTRÓI O GRID INTERATIVO (GRID & SNAP) CONTENDO O TEXTO ATUAL DA CATEGORIA + O REGISTRO ATUAL SENDO CRIADO
function atualizarPreviewInline() {
    const grid = document.getElementById("zonaPreviewArrastavel");
    const textoDigitado = document.getElementById("regTextoOutput").value.trim() || "(Frase do registro atual)";

    grid.innerHTML = "";

    // 1. Renderiza as frases já existentes salvas no banco para esta categoria (para servir de referência visual)
    perguntasDaCategoriaAtual.forEach(p => {
        let textoExistente = "";
        if (p.tipo_campo === 'bool' || p.tipo_campo === 'texto') textoExistente = p.texto_output_true;
        if (p.tipo_campo === 'numero') textoExistente = p.texto_output_numero;

        // Se for dropdown, pega a primeira opção válida
        if (p.tipo_campo === 'dropdown' && p.opcoes_dropdown && p.opcoes_dropdown.length > 0) {
            textoExistente = p.opcoes_dropdown[0].texto_output;
        }

        if (textoExistente) {
            const bloco = document.createElement("div");
            bloco.className = "bloco-frase-arrastavel bloco-existente";
            bloco.textContent = textoExistente.replace("{valor}", "[Exemplo]");
            grid.appendChild(bloco);
        }
    });

    // 2. Insere o item dinâmico destacado que o usuário está criando e ordenando agora
    const blocoCriacao = document.createElement("div");
    blocoCriacao.className = "bloco-frase-arrastavel item-criacao";
    blocoCriacao.id = "item_criacao_direta";
    blocoCriacao.textContent = textoDigitado.replace("{valor}", "[10 / Texto]");
    grid.appendChild(blocoCriacao);

    recalcularOrdemPorPosicaoFisica();
}

function recalcularOrdemPorPosicaoFisica() {
    const blocos = [...document.querySelectorAll("#zonaPreviewArrastavel .bloco-frase-arrastavel")];
    let indexCriacao = blocos.findIndex(b => b.id === "item_criacao_direta");

    if (indexCriacao !== -1) {
        // Multiplica por 10 para criar janelas livres de prioridades para inserções futuras (ex: 10, 20, 30...)
        ordemFicticiaAoArrastar = (indexCriacao + 1) * 10;
    } else {
        ordemFicticiaAoArrastar = 10;
    }
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

// OPERAÇÕES DO BANCO DE DADOS (SUPABASE)
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
        if (tipoCampo === 'bool' || tipoCampo === 'integer' || tipoCampo === 'inputfield') {
            const dbTipo = tipoCampo === 'integer' ? 'numero' : (tipoCampo === 'inputfield' ? 'texto' : 'bool');

            const { data: novaPerg, error: err } = await supabaseClient.from('perguntas').insert([{
                categoria_id: categoriaId,
                nome_campo: nomeCampo,
                tipo_campo: dbTipo,
                texto_output_true: dbTipo !== 'numero' ? textoOutput : null,
                ordem_contexto_true: dbTipo !== 'numero' ? ordemFinal : dbTipo === 'texto' ? ordemFinal : null,
                texto_output_numero: dbTipo === 'numero' ? textoOutput : null,
                ordem_contexto_numero: dbTipo === 'numero' ? ordemFinal : null,
                ordem_exibicao: 10,
                registrado_por: colaborador
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
                    registrado_por: colaborador
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

        alert("Opção salva e ordenada com sucesso!");
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
    const categoriaId = document.getElementById("natureza").value;
    const container = document.getElementById("camposDinamicos");
    container.innerHTML = "";
    document.getElementById("painelSugestoes").style.display = "none";
    document.getElementById("resultado").value = "";

    if (!categoriaId) { perguntasDaCategoriaAtual = []; return; }

    try {
        let { data: perguntas } = await supabaseClient.from('perguntas').select('*').eq('categoria_id', categoriaId).order('id', { ascending: true });
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
            const id = gerarId(campo.nome_campo);
            const labelContainer = document.createElement("div");
            labelContainer.className = "header-container-opcao";
            const label = document.createElement("label");
            label.textContent = campo.nome_campo;
            label.htmlFor = id;
            labelContainer.appendChild(label);

            if (campo.tipo_campo === "dropdown") {
                const btnAdd = document.createElement("button");
                btnAdd.className = "btn-atalho-add";
                btnAdd.textContent = "➕ Adicionar Opção";
                btnAdd.onclick = (e) => { e.preventDefault(); abrirAtalhoDropdownExistente(campo.id); };
                labelContainer.appendChild(btnAdd);
            }

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
    } catch (erro) { console.error(erro); }
}

// EXECUTA O CÁLCULO PROBABILÍSTICO BASEADO NOS VOTOS DAS NATUREZAS VINCULADAS
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

// COMPILA E FORMATA DINAMICAMENTE O TEXTO OUTPUT ORDENADO COM BASE NO GRID SNAP
function gerarTextoDoBanco() {
    let listagemFrasesFinais = [];

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "bool" && el.checked && campo.texto_output_true) {
            listagemFrasesFinais.push({
                texto: campo.texto_output_true,
                ordem: campo.ordem_contexto_true || 10
            });
        }
        else if (campo.tipo_campo === "numero" && el.value.trim() !== "" && campo.texto_output_numero) {
            let tratado = campo.texto_output_numero.replace("{valor}", el.value.trim());
            listagemFrasesFinais.push({
                texto: tratado,
                ordem: campo.ordem_contexto_numero || 10
            });
        }
        else if (campo.tipo_campo === "texto" && el.value.trim() !== "" && campo.texto_output_true) {
            let tratado = campo.texto_output_true.replace("{valor}", el.value.trim().toUpperCase());
            listagemFrasesFinais.push({
                texto: tratado,
                ordem: campo.ordem_contexto_true || 10
            });
        }
        else if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.texto_output) {
                listagemFrasesFinais.push({
                    texto: opt.texto_output,
                    ordem: opt.ordem_contexto || 10
                });
            }
        }
    });

    // Ordena as frases de acordo com a prioridade numérica estabelecida pelo arrasto (Grid-Snap)
    listagemFrasesFinais.sort((a, b) => a.ordem - b.ordem);

    const stringFinalCompilada = listagemFrasesFinais.map(f => f.texto).join(" ");
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