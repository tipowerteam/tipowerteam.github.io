// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = []; // Armazena as 770 naturezas vindas do banco
let naturezasSelecionadasParaOId = []; // Armazena temporariamente os vínculos criados no painel

window.onload = async () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
        const btn = document.getElementById("btnTema");
        if (btn) btn.textContent = "Modo Claro";
    }

    await carregarCategoriasDoBanco();
    await carregarNaturezasCopomDatalist();

    document.getElementById("natureza")
        .addEventListener("change", atualizarCamposDoBanco);

    document.getElementById("descricao")
        .addEventListener("input", atualizarTudo);
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

// CONTROLADORES DA SIDEBAR ADMINISTRATIVA
function alternarPainelAdmin() {
    const painel = document.getElementById("painelAdmin");
    painel.classList.toggle("aberto");
}

function alternarCamposRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    document.getElementById("areaDropdownConfig").style.display = tipo === 'dropdown' ? 'block' : 'none';
}

// BUSCA AS 770 NATUREZAS REAIS PARA O AUTOCOMPLETE
async function carregarNaturezasCopomDatalist() {
    try {
        let { data, error } = await supabaseClient
            .from('naturezas_copom')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;
        listaMapeadaNaturezasCopom = data || [];

        const datalist = document.getElementById("listaNaturezasCopom");
        datalist.innerHTML = "";
        listaMapeadaNaturezasCopom.forEach(nat => {
            const option = document.createElement("option");
            option.value = nat.nome;
            option.dataset.id = nat.id;
            datalist.appendChild(option);
        });
    } catch (err) {
        console.error("Erro ao alimentar datalist de naturezas:", err);
    }
}

// ADICIONA NATUREZAS TEMPORARIAMENTE NA LISTA DO PAINEL ANTES DE GRAVAR
function adicionarNaturezaNaLista() {
    const nomeDigitado = document.getElementById("buscaNatureza").value;
    const pesoInformado = parseInt(document.getElementById("regPeso").value) || 0;

    const naturezaEncontrada = listaMapeadaNaturezasCopom.find(n => n.nome === nomeDigitado);
    if (!naturezaEncontrada) {
        alert("Natureza não encontrada na lista oficial do COPOM. Selecione uma sugestão válida.");
        return;
    }

    if (naturezasSelecionadasParaOId.some(n => n.id === naturezaEncontrada.id)) {
        alert("Esta natureza já foi adicionada!");
        return;
    }

    naturezasSelecionadasParaOId.push({
        id: naturezaEncontrada.id,
        nome: naturezaEncontrada.nome,
        peso: pesoInformado
    });

    const ul = document.getElementById("listaNaturezasVinculadas");
    const li = document.createElement("li");
    li.innerHTML = `📌 <strong>${naturezaEncontrada.nome}</strong> (Peso: ${pesoInformado}%)`;
    ul.appendChild(li);

    document.getElementById("buscaNatureza").value = "";
}

// ENVIA A PERGUNTA/OPÇÃO E SEUS RESPECTIVOS VÍNCULOS DE PESO PARA O BANCO
async function salvarNovoRegistroCompleto() {
    const nomeRegistrador = document.getElementById("regAtendente").value.trim();
    const nomeCampo = document.getElementById("regNomeCampo").value.trim();
    const tipoCampo = document.getElementById("regTipoCampo").value;
    const textoOutput = document.getElementById("regTextoOutput").value.trim();
    const ordem = parseInt(document.getElementById("regOrdem").value);
    const categoriaId = document.getElementById("natureza").value;

    if (!nomeRegistrador || !nomeCampo || !textoOutput || !categoriaId) {
        alert("Por favor, preencha todos os campos do painel e verifique se uma Categoria de Ocorrência está selecionada no painel central.");
        return;
    }

    if (naturezasSelecionadasParaOId.length === 0) {
        alert("Adicione ao menos uma Natureza do COPOM e defina seu peso antes de registrar!");
        return;
    }

    try {
        if (tipoCampo === 'bool' || tipoCampo === 'numero') {
            const { data: novaPergunta, error: errPerg } = await supabaseClient
                .from('perguntas')
                .insert([{
                    categoria_id: categoriaId,
                    nome_campo: nomeCampo,
                    tipo_campo: tipoCampo,
                    texto_output_true: tipoCampo === 'bool' ? textoOutput : null,
                    ordem_contexto_true: tipoCampo === 'bool' ? ordem : null,
                    texto_output_numero: tipoCampo === 'numero' ? textoOutput : null,
                    ordem_contexto_numero: tipoCampo === 'numero' ? ordem : null
                }]).select();

            if (errPerg) throw errPerg;
            const perguntaId = novaPergunta[0].id;

            for (const nat of naturezasSelecionadasParaOId) {
                await supabaseClient.from('vinculos_pesos').insert([{
                    pergunta_id: perguntaId,
                    natureza_id: nat.id,
                    peso: nat.peso
                }]);
            }

        } else if (tipoCampo === 'dropdown') {
            let { data: perguntaMae } = await supabaseClient
                .from('perguntas')
                .select('id')
                .eq('nome_campo', nomeCampo)
                .eq('categoria_id', categoriaId)
                .maybeSingle();

            if (!perguntaMae) {
                const { data: novaPergMae } = await supabaseClient
                    .from('perguntas')
                    .insert([{ categoria_id: categoriaId, nome_campo: nomeCampo, tipo_campo: 'dropdown' }])
                    .select();
                perguntaMae = novaPergMae[0];
            }

            const valorOpcao = document.getElementById("regValorOpcao").value.trim();
            if (!valorOpcao) {
                alert("Para campos do tipo dropdown, defina o Valor Selecionável da Opção.");
                return;
            }

            const { data: novaOpcao, error: errOpt } = await supabaseClient
                .from('opcoes_dropdown')
                .insert([{
                    pergunta_id: perguntaMae.id,
                    valor_opcao: valorOpcao,
                    texto_output: textoOutput,
                    ordem_contexto: ordem
                }]).select();

            if (errOpt) throw errOpt;
            const opcaoId = novaOpcao[0].id;

            for (const nat of naturezasSelecionadasParaOId) {
                await supabaseClient.from('vinculos_pesos').insert([{
                    opcao_dropdown_id: opcaoId,
                    natureza_id: nat.id,
                    peso: nat.peso
                }]);
            }
        }

        alert(`Obrigado ${nomeRegistrador}, o registro foi adicionado e associado com sucesso!`);

        // Limpa o painel admin
        document.getElementById("regNomeCampo").value = "";
        document.getElementById("regValorOpcao").value = "";
        document.getElementById("regTextoOutput").value = "";
        document.getElementById("listaNaturezasVinculadas").innerHTML = "";
        naturezasSelecionadasParaOId = [];

        alternarPainelAdmin();
        await atualizarCamposDoBanco();

    } catch (err) {
        console.error("Erro ao gravar dados pelas tabelas relacionais:", err);
        alert("Falha ao sincronizar o registro com o banco de dados.");
    }
}

// LOGICAS DO SISTEMA PRINCIPAL (ATENDENTE)
async function carregarCategoriasDoBanco() {
    try {
        let { data, error } = await supabaseClient
            .from('categorias')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;
        dadosNaturezas = data || [];

        const select = document.getElementById("natureza");
        select.innerHTML = '<option value="">Selecione a Categoria...</option>';
        dadosNaturezas.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.nome;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao carregar as categorias:", erro);
    }
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
                vinculos_pesos ( peso, naturezas_copom ( nome ) ),
                opcoes_dropdown ( 
                    id, valor_opcao, texto_output, ordem_contexto,
                    vinculos_pesos ( peso, naturezas_copom ( nome ) )
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

            if (campo.tipo_campo === "numero") {
                const numero = document.createElement("input");
                numero.type = "number";
                numero.id = id;
                numero.min = "0";
                numero.addEventListener("input", atualizarTudo);
                divGroup.appendChild(numero);
            }

            container.appendChild(divGroup);
        });
    } catch (erro) {
        console.error("Erro ao processar campos dinâmicos:", erro);
    }
}

function calcularProbabilidadesDoBanco() {
    if (!perguntasDaCategoriaAtual.length) return;

    let pontuacaoNaturezas = {};

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.vinculos_pesos) {
                opt.vinculos_pesos.forEach(v => {
                    const nomeNat = v.naturezas_copom?.nome;
                    if (nomeNat) pontuacaoNaturezas[nomeNat] = (pontuacaoNaturezas[nomeNat] || 0) + v.peso;
                });
            }
        }

        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.vinculos_pesos) {
                campo.vinculos_pesos.forEach(v => {
                    const nomeNat = v.naturezas_copom?.nome;
                    if (nomeNat) pontuacaoNaturezas[nomeNat] = (pontuacaoNaturezas[nomeNat] || 0) + v.peso;
                });
            }
        }
    });

    const lista = document.getElementById("listaSugestoes");
    if (!lista) return;
    lista.innerHTML = "";

    const entradasOrdenadas = Object.entries(pontuacaoNaturezas)
        .filter(([_, peso]) => peso > 0)
        .sort((a, b) => b[1] - a[1]);

    if (entradasOrdenadas.length > 0) {
        document.getElementById("painelSugestoes").style.display = "block";
        entradasOrdenadas.forEach(([nomeNat, pontos]) => {
            const li = document.createElement("li");
            const porcentagem = pontos > 100 ? 100 : pontos;
            li.innerHTML = `<strong>${nomeNat}</strong> - (${porcentagem}% de compatibilidade)`;
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

        if (campo.tipo_campo === "numero" && el.value) {
            if (campo.texto_output_numero) {
                const txtPronto = campo.texto_output_numero.replace("{valor}", el.value);
                fragmentosFrase.push({ texto: txtPronto, ordem: campo.ordem_contexto_numero });
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
    if (!resultado || !resultado.value) {
        alert("Não há texto gerado para copiar!");
        return;
    }
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
    return texto.toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/__+/g, "_");
}