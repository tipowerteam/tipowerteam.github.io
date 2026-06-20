let dadosNaturezas;
let dadosOcorrencias;

window.onload = async () => {

    await carregarDados();

    preencherNaturezas();

    document
        .getElementById("natureza")
        .addEventListener(
            "change",
            atualizarCampos
        );
};

async function carregarDados() {

    try {

        const respostaNaturezas = await fetch("dados/naturezas.json");

        if (!respostaNaturezas.ok)
            throw new Error("Erro carregando naturezas.json");

        dadosNaturezas = await respostaNaturezas.json();

        const respostaOcorrencias = await fetch("dados/ocorrencias.json");
            
        if (!respostaOcorrencias.ok)
            throw new Error("Erro carregando ocorrencias.json");

        dadosOcorrencias = await respostaOcorrencias.json();

        console.log("Naturezas carregadas:");
        console.log(dadosNaturezas);

        console.log("Ocorrências carregadas:");
        console.log(dadosOcorrencias);

    }
    catch (erro) {

        console.error(erro);

        alert(
            "Erro carregando arquivos JSON. Abra o Console (F12)."
        );
    }
}

function preencherNaturezas() {

    const select = document.getElementById("natureza");

    select.innerHTML = '<option value="">Selecione</option>';

    dadosNaturezas.naturezas.forEach(natureza => {

        const option =
            document.createElement("option");

        option.value = natureza;

        option.textContent = natureza;

        select.appendChild(option);
    });
}

function atualizarCampos() {

    const natureza = document.getElementById("natureza").value;
    const container = document.getElementById("camposDinamicos");

    container.innerHTML = "";

    if (!natureza)
        return;

    const dados = dadosOcorrencias[natureza];

    if (!dados)
        return;

    dados.campos.forEach(campo => {

        const label =
            document.createElement("label");

        label.textContent =
            campo.nome;

        container.appendChild(label);

        if (campo.tipo === "dropdown") {

            const select =
                document.createElement("select");

            select.id =
                gerarId(campo.nome);

            campo.opcoes.forEach(opcao => {

                const option =
                    document.createElement("option");

                option.value = opcao;

                option.textContent = opcao;

                select.appendChild(option);
            });

            container.appendChild(select);
        }

        if (campo.tipo === "bool") {

            const checkbox =
                document.createElement("input");

            checkbox.type =
                "checkbox";

            checkbox.id =
                gerarId(campo.nome);

            container.appendChild(checkbox);
        }

        if (campo.tipo === "numero") {

            const numero =
                document.createElement("input");

            numero.type =
                "number";

            numero.id =
                gerarId(campo.nome);

            container.appendChild(numero);
        }
    });
}

function gerarId(texto) {

    return texto
        .replaceAll(" ", "_")
        .replaceAll("ã", "a")
        .replaceAll("á", "a")
        .replaceAll("é", "e");
}

function gerarTexto() {

    const nome =
        document.getElementById("nome").value;

    const natureza =
        document.getElementById("natureza").value;

    let texto =

        `ATENDENTE: ${nome}

        NATUREZA: ${natureza}
        `;

    const dados = dadosOcorrencias[natureza];

    if (dados) {

        dados.campos.forEach(campo => {

            const id =
                gerarId(campo.nome);

            const elemento =
                document.getElementById(id);

            let valor = "";

            if (campo.tipo === "dropdown")
                valor = elemento.value;

            if (campo.tipo === "numero")
                valor = elemento.value;

            if (campo.tipo === "bool")
                valor = elemento.checked
                    ? "SIM"
                    : "NÃO";

            texto +=
                `\n${campo.nome}: ${valor}`;
        });
    }

    texto +=

        `\n
DESCRIÇÃO:

${document.getElementById("descricao").value}`;

    document
        .getElementById("resultado")
        .value = texto;
}