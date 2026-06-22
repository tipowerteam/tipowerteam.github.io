// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

// Correção da inicialização global do Supabase utilizando a CDN do navegador
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];

window.onload = async () => {
    // Aplica o tema salvo antes de carregar o resto para evitar o "piscar" de tela branca
    if (localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
        const btn = document.getElementById("btnTema");
        if (btn) btn.textContent = "Modo Claro";
    }

    await carregarCategoriasDoBanco();

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
        console.error("Erro ao conectar com o Supabase:", erro);
        alert("Erro ao carregar as categorias.");
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
                id, nome_campo, tipo_campo, texto_output_true, ordem_contexto_true, pesos_true,
                texto_output_numero, ordem_contexto_numero, ordem_exibicao,
                opcoes_dropdown ( id, valor_opcao, texto_output, ordem_contexto, pesos )
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
            if (opt && opt.pesos) {
                for (let [nat, peso] of Object.entries(opt.pesos)) {
                    pontuacaoNaturezas[nat] = (pontuacaoNaturezas[nat] || 0) + peso;
                }
            }
        }

        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.pesos_true) {
                for (let [nat, peso] of Object.entries(campo.pesos_true)) {
                    pontuacaoNaturezas[nat] = (pontuacaoNaturezas[nat] || 0) + peso;
                }
            }
        }
    });

    const lista = document.getElementById("listaSugestoes");
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

    // Ordenação garantindo que a hierarquia estrutural/gramatical das palavras seja respeitada
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
    if (!resultado.value) {
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