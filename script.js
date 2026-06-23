// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = []; // Cache local para busca instantânea e autocomplete
let naturezasVinculadasNoPainel = []; // IDs selecionados no painel admin

window.onload = async () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
        const btn = document.getElementById("btnTema");
        if (btn) btn.textContent = "Modo Claro";
    }

    await carregarCategoriasDoBanco();
    await baixarEGuardarTodasAsNaturezas();

    document.getElementById("natureza").addEventListener("change", atualizarCamposDoBanco);
    document.getElementById("descricao").addEventListener("input", atualizarTudo);
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

function alternarPainelAdmin() {
    document.getElementById("painelAdmin").classList.toggle("aberto");
}

function alternarCamposRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    document.getElementById("areaDropdownExistenteConfig").style.display = tipo === 'dropdown_existente' ? 'block' : 'none';
    document.getElementById("areaDropdownNovoConfig").style.display = tipo === 'dropdown_novo' ? 'block' : 'none';
}

// BAIXA TODAS AS NATUREZAS DO COPOM PARA O AUTOCOMPLETE INTELIGENTE LOCAL
async function baixarEGuardarTodasAsNaturezas() {
    try {
        let { data, error } = await supabaseClient
            .from('naturezas_copom')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;
        listaMapeadaNaturezasCopom = data || [];
    } catch (err) {
        console.error("Verifique as Políticas RLS da tabela naturezas_copom no Supabase:", err);
    }
}

// FILTRAGEM INTELIGENTE DINÂMICA (Aparece ao digitar 'VIO' por exemplo)
function filtrarNaturezasAutocomplete(termoBusca) {
    const painel = document.getElementById("painelSugestoesInstantes");
    if (!termoBusca || termoBusca.trim().length < 2) {
        painel.style.display = "none";
        return;
    }

    const termoLimpo = termoBusca.toUpperCase();
    const filtradas = listaMapeadaNaturezasCopom.filter(nat => nat.nome.toUpperCase().includes(termoLimpo));

    if (filtradas.length === 0) {
        painel.innerHTML = '<div class="item-sugestao">Nenhuma correspondência encontrada</div>';
    } else {
        painel.innerHTML = "";
        filtradas.slice(0, 15).forEach(nat => { // Exibe até 15 sugestões para performance
            const div = document.createElement("div");
            div.className = "item-sugestao";
            div.textContent = nat.nome;
            div.onclick = () => vincularNaturezaAdmin(nat.id, nat.nome);
            painel.appendChild(div);
        });
    }
    painel.style.display = "block";
}

function vincularNaturezaAdmin(id, nome) {
    document.getElementById("painelSugestoesInstantes").style.display = "none";
    document.getElementById("buscaNatureza").value = "";

    if (naturezasVinculadasNoPainel.includes(id)) return;

    naturezasVinculadasNoPainel.push(id);
    renderizarTagsNaturezas();
}

function removerNaturezaAdmin(id) {
    naturezasVinculadasNoPainel = naturezasVinculadasNoPainel.filter(nId => nId !== id);
    renderizarTagsNaturezas();
}

function renderizarTagsNaturezas() {
    const ul = document.getElementById("listaNaturezasVinculadas");
    ul.innerHTML = "";
    naturezasVinculadasNoPainel.forEach(id => {
        const natObj = listaMapeadaNaturezasCopom.find(n => n.id === id);
        if (natObj) {
            const li = document.createElement("li");
            li.innerHTML = `${natObj.nome} <button class="btn-remover-tag" onclick="removerNaturezaAdmin(${id})">&times;</button>`;
            ul.appendChild(li);
        }
    });
}

// PREENCHE OS DROP-DOWNS DO PAINEL ADMINISTRATIVO COM BASE NA CATEGORIA SELECIONADA
async function atualizarDropdownsExistentesDaCategoria() {
    const catId = document.getElementById("regCategoria").value;
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

// GRAVA DE FORMA INTELIGENTE, METADADOS DE QUEM CRIOU E ASSOCIAÇÕES MULTIPLAS
async function salvarNovoRegistroCompleto() {
    const colaborador = document.getElementById("regAtendente").value.trim();
    const categoriaId = document.getElementById("regCategoria").value;
    const nomeCampo = document.getElementById("regNomeCampo").value.trim();
    const tipoCampo = document.getElementById("regTipoCampo").value;
    const textoOutput = document.getElementById("regTextoOutput").value.trim();
    const ordem = parseInt(document.getElementById("regOrdem").value) || 10;

    if (!colaborador || !categoriaId || !nomeCampo || !textoOutput) {
        alert("Preencha todos os campos obrigatórios e selecione a categoria.");
        return;
    }
    if (naturezasVinculadasNoPainel.length === 0) {
        alert("Vincule ao menos uma natureza possível através do campo de busca inteligente!");
        return;
    }

    try {
        // Objeto de auditoria para saber quem registrou e o que registrou
        const auditoriaMetadata = `Criado por: ${colaborador} em ${new Date().toLocaleDateString()}`;

        if (tipoCampo === 'bool' || tipoCampo === 'numero' || tipoCampo === 'texto') {
            const { data: novaPerg, error: err } = await supabaseClient
                .from('perguntas')
                .insert([{
                    categoria_id: categoriaId,
                    nome_campo: nomeCampo,
                    tipo_campo: tipoCampo === 'texto' ? 'texto' : tipoCampo,
                    texto_output_true: tipoCampo === 'bool' ? textoOutput : null,
                    ordem_contexto_true: tipoCampo === 'bool' ? ordem : null,
                    texto_output_numero: tipoCampo === 'numero' ? textoOutput : null,
                    ordem_contexto_numero: tipoCampo === 'numero' ? ordem : null,
                    registrado_por: auditoriaMetadata // Campo de rastreamento no banco
                }]).select();

            if (err) throw err;

            // Insere os vínculos associativos (Sem pesos numéricos fixos manuais)
            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ pergunta_id: novaPerg[0].id, natureza_id: nId }]);
            }

        } else if (tipoCampo === 'dropdown_novo') {
            const valorInicial = document.getElementById("regValorOpcaoNovo").value.trim() || "Padrão";
            const { data: novaPerg, error: err } = await supabaseClient
                .from('perguntas')
                .insert([{ categoria_id: categoriaId, nome_campo: nomeCampo, tipo_campo: 'dropdown', registrado_por: auditoriaMetadata }]).select();

            if (err) throw err;

            const { data: novaOpt } = await supabaseClient
                .from('opcoes_dropdown')
                .insert([{ pergunta_id: novaPerg[0].id, valor_opcao: valorInicial, texto_output: textoOutput, ordem_contexto: ordem }]).select();

            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }]);
            }

        } else if (tipoCampo === 'dropdown_existente') {
            const perguntaIdMae = document.getElementById("regDropdownMae").value;
            const valorSubOpcao = document.getElementById("regValorOpcao").value.trim();

            if (!perguntaIdMae || !valorSubOpcao) {
                alert("Selecione o dropdown existente e digite o valor da opção.");
                return;
            }

            const { data: novaOpt, error: err } = await supabaseClient
                .from('opcoes_dropdown')
                .insert([{ pergunta_id: perguntaIdMae, valor_opcao: valorSubOpcao, texto_output: textoOutput, ordem_contexto: ordem }]).select();

            if (err) throw err;

            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }]);
            }
        }

        alert(`Sucesso! Registro catalogado sob responsabilidade de: ${colaborador}`);

        // Reset Admin form
        document.getElementById("regNomeCampo").value = "";
        document.getElementById("regTextoOutput").value = "";
        naturezasVinculadasNoPainel = [];
        renderizarTagsNaturezas();
        alternarPainelAdmin();
        await atualizarCamposDoBanco();

    } catch (e) {
        console.error(e);
        alert("Erro ao sincronizar dados relacionais com o Supabase.");
    }
}

// LÓGICAS DO ATENDENTE E CÁLCULO PROPORCIONAL SEM PESOS MANUAIS (Puro/Frequência)
async function carregarCategoriasDoBanco() {
    try {
        let { data, error } = await supabaseClient.from('categorias').select('*').order('nome', { ascending: true });
        if (error) throw error;
        dadosNaturezas = data || [];

        const selectPrincipal = document.getElementById("natureza");
        const selectAdmin = document.getElementById("regCategoria");

        selectPrincipal.innerHTML = '<option value="">Selecione a Categoria...</option>';
        selectAdmin.innerHTML = '<option value="">Selecione uma categoria base...</option>';

        dadosNaturezas.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.nome;
            selectPrincipal.appendChild(option.cloneNode(true));
            selectAdmin.appendChild(option);
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
        let { data: perguntas, error } = await supabaseClient
            .from('perguntas')
            .select(`
                id, nome_campo, tipo_campo, texto_output_true, ordem_contexto_true,
                texto_output_numero, ordem_contexto_numero, ordem_exibicao,
                vinculos_pesos ( naturezas_copom ( nome ) ),
                opcoes_dropdown ( 
                    id, valor_opcao, texto_output, ordem_contexto,
                    vinculos_pesos ( naturezas_copom ( nome ) )
                )
            `)
            .eq('categoria_id', categoriaId)
            .order('ordem_exibicao', { ascending: true });

        if (error) throw error;
        perguntasDaCategoriaAtual = perguntas || [];

        perguntasDaCategoriaAtual.forEach(campo => {
            const divGroup = document.createElement("div");
            const label = document.createElement("label");
            label.textContent = campo.nome_campo;
            divGroup.appendChild(label);

            const id = gerarId(campo.nome_campo);

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
                select.addEventListener("change", atualizarTudo);
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
                if (campo.tipo_campo === "numero") input.min = "0";
                input.addEventListener("input", atualizarTudo);
                divGroup.appendChild(input);
            }

            container.appendChild(divGroup);
        });
    } catch (erro) { console.error(erro); }
}

// CÁLCULO DE PROPORÇÃO MATEMÁTICA PURA (Baseado na frequência de ligações ativas)
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
                opt.vinculos_pesos.forEach(v => {
                    if (v.naturezas_copom?.nome) arrayVotosNaturezas.push(v.naturezas_copom.nome);
                });
            }
        }

        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.vinculos_pesos) {
                campo.vinculos_pesos.forEach(v => {
                    if (v.naturezas_copom?.nome) arrayVotosNaturezas.push(v.naturezas_copom.nome);
                });
            }
        }

        if ((campo.tipo_campo === "numero" || campo.tipo_campo === "texto") && el.value.trim() !== "") {
            if (campo.vinculos_pesos) {
                campo.vinculos_pesos.forEach(v => {
                    if (v.naturezas_copom?.nome) arrayVotosNaturezas.push(v.naturezas_copom.nome);
                });
            }
        }
    });

    const lista = document.getElementById("listaSugestoes");
    if (!lista) return;
    lista.innerHTML = "";

    const totalDeVotosAtivos = arrayVotosNaturezas.length;

    if (totalDeVotosAtivos > 0) {
        // Conta as ocorrências de cada string de natureza
        let contagemFrequencia = {};
        arrayVotosNaturezas.forEach(nome => {
            contagemFrequencia[nome] = (contagemFrequencia[nome] || 0) + 1;
        });

        const ordenadoPorProporcao = Object.entries(contagemFrequencia)
            .sort((a, b) => b[1] - a[1]);

        document.getElementById("painelSugestoes").style.display = "block";
        ordenadoPorProporcao.forEach(([nomeNat, quantidade]) => {
            const li = document.createElement("li");
            const proporcaoCalculada = Math.round((quantidade / totalDeVotosAtivos) * 100);
            li.innerHTML = `<strong>${nomeNat}</strong> - (${proporcaoCalculada}% de compatibilidade baseada nas opções)`;
            lista.appendChild(li);
        });
    } else {
        document.getElementById("painelSugestoes").style.display = "none";
    }
}

function gerarTextoDoBanco() {
    const selectCat = document.getElementById("natureza");
    const categoriaTexto = selectCat.options[selectCat.selectedIndex]?.text || "";

    if (!categoriaTexto || !perguntasDaCategoriaAtual.length) return;

    let fragmentosFrase = [];

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.texto_output) {
                fragmentosFrase.push({ texto: opt.texto_output, ordem: opt.ordem_contexto });
            }
        }

        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.texto_output_true) {
                fragmentosFrase.push({ texto: campo.texto_output_true, ordem: campo.ordem_contexto_true });
            }
        }

        if ((campo.tipo_campo === "numero" || campo.tipo_campo === "texto") && el.value) {
            const txtBase = campo.tipo_campo === "numero" ? campo.texto_output_numero : campo.texto_output_true;
            const ordemBase = campo.tipo_campo === "numero" ? campo.ordem_contexto_numero : campo.ordem_contexto_true;
            if (txtBase) {
                const txtPronto = txtBase.replace("{valor}", el.value);
                fragmentosFrase.push({ texto: txtPronto, ordem: ordemBase || 10 });
            }
        }
    });

    fragmentosFrase.sort((a, b) => a.ordem - b.ordem);
    const historicoCompilado = fragmentosFrase.map(f => f.texto).join(" ");
    const compl = document.getElementById("descricao").value;

    let textoFinal = `=== REGISTRO DE OCORRÊNCIA COPOM ===\n`;
    textoFinal += `CATEGORIA: ${categoriaTexto}\n`;
    textoFinal += `HISTÓRICO COMPILADO: ${historicoCompilado.trim()}\n`;
    if (compl) textoFinal += `INFO COMPLEMENTAR: ${compl}\n`;
    textoFinal += `====================================`;

    document.getElementById("resultado").value = textoFinal;
}

function copiarTexto() {
    const resultado = document.getElementById("resultado");
    if (!resultado || !resultado.value) return;
    navigator.clipboard.writeText(resultado.value);
    alert("Copiado para a área de transferência!");
}

function limparPagina() {
    document.getElementById("natureza").value = "";
    document.getElementById("descricao").value = "";
    document.getElementById("resultado").value = "";
    document.getElementById("camposDinamicos").innerHTML = "";
    document.getElementById("painelSugestoes").style.display = "none";
    perguntasDaCategoriaAtual = [];
}

function gerarId(texto) {
    return texto.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/__+/g, "_");
}