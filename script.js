let dadosNaturezas;
let dadosOcorrencias;

window.onload = async () => {
    await carregarDados();
    preencherNaturezas();
    document.getElementById("natureza").addEventListener("change", atualizarCampos);

    // Recupera o tema salvo no navegador do atendente
    if (localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
    }
};

function alternarTema() {
    const atual = document.body.getAttribute("data-theme");
    if (atual === "dark") {
        document.body.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
    } else {
        document.body.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
    }
}

async function carregarDados() {
    try {
        const respostaNaturezas = await fetch("dados/naturezas.json");
        dadosNaturezas = await respostaNaturezas.json();

        const respostaOcorrencias = await fetch("dados/ocorrencias.json");
        dadosOcorrencias = await respostaOcorrencias.json();
    } catch (erro) {
        console.error(erro);
        alert("Erro ao carregar arquivos de configuração.");
    }
}

function preencherNaturezas() {
    const select = document.getElementById("natureza");
    select.innerHTML = '<option value="">Selecione a Categoria</option>';
    dadosNaturezas.naturezas.forEach(nat => {
        const option = document.createElement("option");
        option.value = nat;
        option.textContent = nat;
        select.appendChild(option);
    });
}

function atualizarCampos() {
    const natureza = document.getElementById("natureza").value;
    const container = document.getElementById("camposDinamicos");
    container.innerHTML = "";
    document.getElementById("painelSugestoes").style.display = "none";

    if (!natureza || !dadosOcorrencias[natureza]) return;

    const dados = dadosOcorrencias[natureza];

    dados.campos.forEach(campo => {
        const divGroup = document.createElement("div");
        const label = document.createElement("label");
        label.textContent = campo.nome;
        divGroup.appendChild(label);

        const id = gerarId(campo.nome);

        if (campo.tipo === "dropdown") {
            const select = document.createElement("select");
            select.id = id;
            select.innerHTML = '<option value="">Selecione...</option>';

            campo.opcoes.forEach(opcao => {
                const option = document.createElement("option");
                option.value = opcao.valor;
                option.textContent = opcao.valor;
                select.appendChild(option);
            });
            // Sempre que o atendente mudar algo, recalcula a natureza provável
            select.addEventListener("change", calcularProbabilidades);
            divGroup.appendChild(select);
        }

        if (campo.tipo === "bool") {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = id;
            checkbox.style.width = "auto";
            checkbox.style.marginLeft = "10px";
            checkbox.addEventListener("change", calcularProbabilidades);
            divGroup.appendChild(checkbox);
        }

        if (campo.tipo === "numero") {
            const numero = document.createElement("input");
            numero.type = "number";
            numero.id = id;
            numero.addEventListener("input", calcularProbabilidades);
            divGroup.appendChild(numero);
        }

        container.appendChild(divGroup);
    });
}

function calcularProbabilidades() {
    const natureza = document.getElementById("natureza").value;
    if (!natureza) return;

    const dados = dadosOcorrencias[natureza];
    let pontuacaoNaturezas = {};

    dados.campos.forEach(campo => {
        const id = gerarId(campo.nome);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo === "dropdown" && el.value) {
            const opcaoSelecionada = campo.opcoes.find(o => o.valor === el.value);
            if (opcaoSelecionada && opcaoSelecionada.pesos) {
                for (let [natReal, peso] of Object.entries(opcaoSelecionada.pesos)) {
                    pontuacaoNaturezas[natReal] = (pontuacaoNaturezas[natReal] || 0) + peso;
                }
            }
        }

        if (campo.tipo === "bool" && el.checked) {
            if (campo.pesos_true) {
                for (let [natReal, peso] of Object.entries(campo.pesos_true)) {
                    pontuacaoNaturezas[natReal] = (pontuacaoNaturezas[natReal] || 0) + peso;
                }
            }
        }
    });

    // Renderizar na tela as naturezas mais prováveis
    const lista = document.getElementById("listaSugestoes");
    lista.innerHTML = "";

    const entradasOrdenadas = Object.entries(pontuacaoNaturezas)
        .filter(([_, peso]) => peso > 0)
        .sort((a, b) => b[1] - a[1]);

    if (entradasOrdenadas.length > 0) {
        document.getElementById("painelSugestoes").style.display = "block";
        entradasOrdenadas.forEach(([nomeNat, pontos]) => {
            const li = document.createElement("li");
            // Limitando a exibição ao teto lógico de 100% de compatibilidade fictícia por pontos
            const porcentagem = pontos > 100 ? 100 : pontos;
            li.innerHTML = `<strong>${nomeNat}</strong> - (${porcentagem}% de compatibilidade)`;
            lista.appendChild(li);
        });
    } else {
        document.getElementById("painelSugestoes").style.display = "none";
    }
}

function gerarTexto() {
    const nome = document.getElementById("nomeAtendente").value || "NÃO INFORMADO";
    const categoria = document.getElementById("natureza").value;

    let stringOcorrencia = "";
    const dados = dadosOcorrencias[categoria];

    if (dados) {
        dados.campos.forEach(campo => {
            const id = gerarId(campo.nome);
            const el = document.getElementById(id);
            if (!el) return;

            if (campo.tipo === "dropdown" && el.value) {
                const opt = campo.opcoes.find(o => o.valor === el.value);
                if (opt && opt.texto_output) stringOcorrencia += opt.texto_output + " ";
            }
            if (campo.tipo === "bool" && el.checked) {
                if (campo.texto_output_true) stringOcorrencia += campo.texto_output_true + " ";
            }
        });
    }

    const compl = document.getElementById("descricao").value;

    let textoFinal = `=== REGISTRO DE OCORRÊNCIA COPOM ===\n`;
    textoFinal += `ATENDENTE: ${nome}\n`;
    textoFinal += `CATEGORIA: ${categoria}\n`;
    textoFinal += `HISTÓRICO COMPILADO: ${stringOcorrencia.trim()}\n`;
    if (compl) textoFinal += `INFO COMPLEMENTAR: ${compl}\n`;
    textoFinal += `====================================`;

    document.getElementById("resultado").value = textoFinal;
}

function gerarId(texto) {
    return texto.toLowerCase()
        .replace(/[^a-z0-9]/g, "_") // Cria IDs padronizados de forma mais segura
        .replace(/__+/g, "_");
}