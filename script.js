const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = [];
let naturezasVinculadasNoPainel = [];

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
            if (primeiraOpcao && primeiraOpcao.value === "") {
                primeiraOpcao.remove();
            }
            // Exibe o botão de criar perguntas apenas se houver categoria ativa
            document.getElementById("areaBotaoNovaOpcao").style.display = "block";
        } else {
            document.getElementById("areaBotaoNovaOpcao").style.display = "none";
            fecharFormCriarOpcao();
        }
        atualizarCamposDoBanco();
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

// CONTROLADORES DE INTERFACE INLINE (TELA PRINCIPAL)
function exibirFormCriarCategoria() {
    document.getElementById("areaCriarCategoria").style.display = "block";
}
function fecharFormCriarCategoria() {
    document.getElementById("areaCriarCategoria").style.display = "none";
    document.getElementById("newCatNome").value = "";
}

function exibirFormCriarOpcao() {
    document.getElementById("areaCriarOpcao").style.display = "block";
    atualizarDropdownsExistentesDaCategoriaInline();
    atualizarPreviewInline();
}
function fecharFormCriarOpcao() {
    document.getElementById("areaCriarOpcao").style.display = "none";
    document.getElementById("regNomeCampo").value = "";
    document.getElementById("regTextoOutput").value = "";
    document.getElementById("regNomeDropdownNovo").value = "";
    naturezasVinculadasNoPainel = [];
    renderizarTagsNaturezas();
    atualizarTudo();
}

function alternarCamposRegistroInline() {
    const tipo = document.getElementById("regTipoCampo").value;
    document.getElementById("areaDropdownExistenteConfig").style.display = tipo === 'dropdown_existente' ? 'block' : 'none';
    document.getElementById("areaDropdownNovoConfig").style.display = tipo === 'dropdown_novo' ? 'block' : 'none';
}

function abrirAtalhoDropdownExistente(perguntaId) {
    exibirFormCriarOpcao();
    document.getElementById("regTipoCampo").value = "dropdown_existente";
    alternarCamposRegistroInline();
    setTimeout(() => {
        document.getElementById("regDropdownMae").value = perguntaId;
    }, 300);
}

// PREVIEW DINÂMICO EM TEMPO REAL DIRETAMENTE NO TEXTAREA DE OUTPUT
function atualizarPreviewInline() {
    gerarTextoDoBanco();
}

async function atualizarDropdownsExistentesDaCategoriaInline() {
    const catId = document.getElementById("natureza").value;
    const selectDropdownsMap = document.getElementById("regDropdownMae");
    selectDropdownsMap.innerHTML = '<option value="">Carregando...</option>';

    if (!catId) return;

    try {
        let { data } = await supabaseClient
            .from('perguntas')
            .select('id, nome_campo')
            .eq('categoria_id', catId)
            .eq('tipo_campo', 'dropdown');

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
    if (!nomeCat) {
        alert("Digite o nome da categoria!");
        return;
    }
    try {
        const { error } = await supabaseClient.from('categorias').insert([{ nome: nomeCat }]);
        if (error) throw error;
        alert("Categoria adicionada com sucesso!");
        fecharFormCriarCategoria();
        await carregarCategoriasDoBanco();
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar categoria.");
    }
}

async function salvarNovoRegistroInline() {
    const colaborador = "Atendente Autenticado";
    const categoriaId = document.getElementById("natureza").value;
    const tipoCampo = document.getElementById("regTipoCampo").value;
    const textoOutput = document.getElementById("regTextoOutput").value.trim();
    const ordem = parseInt(document.getElementById("regOrdem").value) || 10;

    let nomeCampo = document.getElementById("regNomeCampo").value.trim();

    if (tipoCampo === 'dropdown_novo') {
        nomeCampo = document.getElementById("regNomeDropdownNovo").value.trim();
    }

    if (!categoriaId || !nomeCampo || !textoOutput) {
        alert("Preencha todos os campos obrigatórios para o registro!");
        return;
    }

    try {
        if (tipoCampo === 'bool' || tipoCampo === 'numero' || tipoCampo === 'texto') {
            const { data: novaPerg, error: err } = await supabaseClient
                .from('perguntas')
                .insert([{
                    categoria_id: categoriaId,
                    nome_campo: nomeCampo,
                    tipo_campo: tipoCampo,
                    texto_output_true: tipoCampo === 'bool' ? textoOutput : null,
                    ordem_contexto_true: tipoCampo === 'bool' ? ordem : null,
                    texto_output_numero: tipoCampo === 'numero' ? textoOutput : null,
                    ordem_contexto_numero: tipoCampo === 'numero' ? ordem : null,
                    registrado_por: colaborador
                }]).select();

            if (err) throw err;

            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ pergunta_id: novaPerg[0].id, natureza_id: nId }]);
            }

        } else if (tipoCampo === 'dropdown_novo') {
            const valorInicial = document.getElementById("regNomeCampo").value.trim() || "Padrão";
            const { data: novaPerg, error: err } = await supabaseClient
                .from('perguntas')
                .insert([{
                    categoria_id: categoriaId,
                    nome_campo: nomeCampo,
                    tipo_campo: 'dropdown',
                    registrado_por: colaborador
                }]).select();

            if (err) throw err;

            const { data: novaOpt } = await supabaseClient
                .from('opcoes_dropdown')
                .insert([{
                    pergunta_id: novaPerg[0].id,
                    valor_opcao: valorInicial,
                    texto_output: textoOutput,
                    ordem_contexto: ordem,
                    registrado_por: colaborador
                }]).select();

            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }]);
            }

        } else if (tipoCampo === 'dropdown_existente') {
            const perguntaIdMae = document.getElementById("regDropdownMae").value;
            if (!perguntaIdMae) {
                alert("Selecione o dropdown existente alvo!");
                return;
            }

            const { data: novaOpt, error: err } = await supabaseClient
                .from('opcoes_dropdown')
                .insert([{
                    pergunta_id: perguntaIdMae,
                    valor_opcao: nomeCampo, // No existente, o título inserido passa a ser o valor selecionável
                    texto_output: textoOutput,
                    ordem_contexto: ordem,
                    registrado_por: colaborador
                }]).select();

            if (err) throw err;

            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }]);
            }
        }

        alert("Opção registrada diretamente no sistema com sucesso!");
        fecharFormCriarOpcao();
        await atualizarCamposDoBanco();

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar dados no Supabase.");
    }
}

async function baixarEGuardarTodasAsNaturezas() {
    try {
        let { data, error } = await supabaseClient.from('naturezas_copom').select('id, natureza');
        if (error) throw error;
        listaMapeadaNaturezasCopom = data || [];
    } catch (err) { console.error(err); }
}

function filtrarNaturezasAutocomplete(termoBusca) {
    const painel = document.getElementById("painelSugestoesInstantes");
    if (!termoBusca || termoBusca.trim().length < 1) {
        painel.style.display = "none";
        return;
    }
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
        let { data, error } = await supabaseClient.from('categorias').select('*').order('id', { ascending: true });
        if (error) throw error;
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

    if (!categoriaId) {
        perguntasDaCategoriaAtual = [];
        return;
    }

    try {
        let { data: perguntas, error: errP } = await supabaseClient
            .from('perguntas')
            .select('*')
            .eq('categoria_id', categoriaId)
            .order('id', { ascending: true });

        if (errP) throw errP;
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
                // Corrigido aqui: Aponta perfeitamente para a nova função inline da tela principal
                btnAdd.onclick = (e) => {
                    e.preventDefault();
                    abrirAtalhoDropdownExistente(campo.id);
                };
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
                select.addEventListener("change", (e) => {
                    if (e.target.value !== "") {
                        const primeiraOpcao = e.target.options[0];
                        if (primeiraOpcao && primeiraOpcao.value === "") primeiraOpcao.remove();
                    }
                    atualizarTudo();
                });
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

    const lista = document.getElementById("listaSugestoes");
    if (!lista) return;
    lista.innerHTML = "";

    const totalDeVotosAtivos = arrayVotosNaturezas.length;
    if (totalDeVotosAtivos > 0) {
        let contagemFrequencia = {};
        arrayVotosNaturezas.forEach(nome => { contagemFrequencia[nome] = (contagemFrequencia[nome] || 0) + 1; });
        const ordenadoPorProporcao = Object.entries(contagemFrequencia).sort((a, b) => b[1] - a[1]);
        document.getElementById("painelSugestoes").style.display = "block";
        ordenadoPorProporcao.forEach(([nomeNat, quantidade]) => {
            const li = document.createElement("li");
            const proporcaoCalculada = Math.round((quantidade / totalDeVotosAtivos) * 100);
            li.innerHTML = `<strong>${nomeNat}</strong> - (${proporcaoCalculada}% de probabilidade)`;
            lista.appendChild(li);
        });
    } else {
        document.getElementById("painelSugestoes").style.display = "none";
    }
}

function gerarTextoDoBanco() {
    const selectCat = document.getElementById("natureza");
    const categoriaTexto = selectCat.options[selectCat.selectedIndex]?.text || "";
    if (!categoriaTexto) return;

    let fragmentosFrase = [];

    // 1. Coleta itens já marcados em tempo real na tela principal
    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt?.texto_output) fragmentosFrase.push({ texto: opt.texto_output, ordem: opt.ordem_contexto || 10 });
        }
        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.texto_output_true) fragmentosFrase.push({ texto: campo.texto_output_true, ordem: campo.ordem_contexto_true || 10 });
        }
        if ((campo.tipo_campo === "numero" || campo.tipo_campo === "texto") && el.value) {
            const txtBase = campo.tipo_campo === "numero" ? campo.texto_output_numero : campo.texto_output_true;
            const ordemBase = campo.tipo_campo === "numero" ? campo.ordem_contexto_numero : campo.ordem_contexto_true;
            if (txtBase) {
                fragmentosFrase.push({ texto: txtBase.replace("{valor}", el.value), ordem: ordemBase || 10 });
            }
        }
    });

    // 2. Injeta dinamicamente a nova opção em criação para visualização imediata do atendente
    const areaOpcaoVisivel = document.getElementById("areaCriarOpcao").style.display === "block";
    const txtNovo = document.getElementById("regTextoOutput").value.trim();
    const ordemNova = parseInt(document.getElementById("regOrdem").value) || 10;
    const tipoNovo = document.getElementById("regTipoCampo").value;

    if (areaOpcaoVisivel && txtNovo) {
        let placeholderTxt = txtNovo;
        if (tipoNovo === 'numero' || tipoNovo === 'texto') {
            placeholderTxt = txtNovo.includes("{valor}") ? txtNovo.replace("{valor}", "[VALOR]") : `${txtNovo} [VALOR]`;
        }
        fragmentosFrase.push({ texto: `<< CRIAÇÃO: ${placeholderTxt} >>`, ordem: ordemNova });
    }

    fragmentosFrase.sort((a, b) => a.ordem - b.ordem);
    const historicoCompilado = fragmentosFrase.map(f => f.texto).join(" ");

    let textoFinal = `=== REGISTRO DE OCORRÊNCIA COPOM ===\n`;
    textoFinal += `CATEGORIA: ${categoriaTexto}\n`;
    textoFinal += `HISTÓRICO COMPILADO: ${historicoCompilado.trim()}\n`;
    textoFinal += `====================================\n`;
    textoFinal += `TA EM FASE DE TESTE GENTE CALMA`;

    document.getElementById("resultado").value = textoFinal;
}

function copiarTexto() {
    const resultado = document.getElementById("resultado");
    if (!resultado || !resultado.value) return;
    navigator.clipboard.writeText(resultado.value);
    const toast = document.getElementById("toastCopia");
    if (toast) {
        toast.classList.add("visivel");
        setTimeout(() => { toast.classList.remove("visivel"); }, 2000);
    }
}

async function limparPagina() {
    document.getElementById("resultado").value = "";
    document.getElementById("camposDinamicos").innerHTML = "";
    document.getElementById("painelSugestoes").style.display = "none";
    document.getElementById("areaBotaoNovaOpcao").style.display = "none";
    perguntasDaCategoriaAtual = [];
    fecharFormCriarOpcao();
    fecharFormCriarCategoria();
    await carregarCategoriasDoBanco();
}

function gerarId(texto) {
    return texto.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/__+/g, "_");
}