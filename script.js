const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = [];
let naturezasVinculadasNoPainel = [];
let naturezasCondicionaisNoPainel = [];
let ordemFicticiaAoArrastar = 10;
let sortableInstance = null;
let sortableCamposInstance = null;

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

    const txtResultado = document.getElementById("resultado");
    const colEsquerda = document.getElementById("colunaDespachoEsquerda");
    const resizer = document.getElementById("resizerBarra");

    // CORREÇÃO DEFINITIVA: Lógica de split-drag manual estável por mouse/touch
    let isDragging = false;

    resizer.addEventListener("mousedown", (e) => {
        isDragging = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none"; // Evita seleção acidental de textos
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        // Calcula a nova largura baseada na posição X do ponteiro
        let novaLargura = e.clientX - colEsquerda.getBoundingClientRect().left;

        // Limita os tamanhos máximos e mínimos para proteção do layout
        const larguraMaxPermitida = window.innerWidth * 0.55; // Máximo 55% da tela
        if (novaLargura >= 320 && novaLargura <= larguraMaxPermitida) {
            colEsquerda.style.width = novaLargura + "px";
        }
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
    });

    const grid = document.getElementById("zonaPreviewArrastavel");
    sortableInstance = new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function () {
            recalcularOrdemPorPosicaoFisica();
        }
    });

    const containerCampos = document.getElementById("camposDinamicos");
    sortableCamposInstance = new Sortable(containerCampos, {
        animation: 150,
        handle: '.input-group-dinamico',
        disabled: true,
        onEnd: async function () {
            if (modoEdicaoAtivo) {
                const blocos = [...document.querySelectorAll("#camposDinamicos .input-group-dinamico")];
                for (let i = 0; i < blocos.length; i++) {
                    const dbId = blocos[i].getAttribute("data-id");
                    const novaOrdemExibicao = (i + 1) * 10;
                    await supabaseClient.from('campos_formulario').update({ ordem_exibicao: novaOrdemExibicao }).eq('id', dbId);
                }
            }
        }
    });

    ajustarAlturaTextarea(txtResultado);
};

async function carregarCategoriasDoBanco() {
    try {
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('id, nome')
            .order('id', { ascending: true });

        const select = document.getElementById("natureza");
        if (error) throw error;

        if (data && data.length > 0) {
            select.innerHTML = '<option value="">-- Selecione uma Categoria --</option>';
            data.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat.id;
                opt.textContent = cat.nome;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Nenhuma categoria encontrada</option>';
        }
    } catch (err) {
        console.error("Erro ao buscar categorias:", err.message);
        document.getElementById("natureza").innerHTML = '<option value="">Erro ao carregar banco</option>';
    }
}

function ajustarAlturaTextarea(elemento) {
    if (!elemento) return;
    elemento.style.height = "auto";
    elemento.style.height = elemento.scrollHeight + "px";
}

async function baixarEGuardarTodasAsNaturezas() {
    try {
        const { data, error } = await supabaseClient.from('naturezas_copom').select('id, naturaleza');
        if (!error && data) listaMapeadaNaturezasCopom = data;
    } catch (e) { console.error(e); }
}

async function atualizarCamposDoBanco() {
    const categoriaId = document.getElementById("natureza").value;
    const container = document.getElementById("camposDinamicos");
    if (!categoriaId) { container.innerHTML = ""; return; }

    const { data, error } = await supabaseClient
        .from('campos_formulario')
        .select(`
            id, categoria_id, nome_campo, tipo_campo, texto_output, ordem_contexto, ordem_exibicao, oculto_ate, forcar_quebra_linha, regra_maior_que,
            regras_natureza(id, natureza_id, condicional_maior_que),
            dropdown_itens(id, valor_opcao, texto_output)
        `)
        .eq('categoria_id', categoriaId)
        .order('ordem_exibicao', { ascending: true });

    if (error) { console.error(error); return; }
    perguntasDaCategoriaAtual = data || [];
    renderizarCamposDinamicosFormulario();
}

function renderizarCamposDinamicosFormulario() {
    const container = document.getElementById("camposDinamicos");
    container.innerHTML = "";

    perguntasDaCategoriaAtual.forEach(campo => {
        const idUnico = gerarId(campo.nome_campo);
        const divBox = document.createElement("div");
        divBox.className = "input-group-dinamico";
        divBox.setAttribute("data-id", campo.id);

        let htmlCampos = `<div class="form-group"><label><strong>${campo.nome_campo}</strong></label>`;

        if (campo.tipo_campo === "bool" || campo.tipo_campo === "character varying" && !campo.dropdown_itens?.length) {
            htmlCampos += `<label class="checkbox-container"><input type="checkbox" id="${idUnico}" onchange="atualizarTudo()"> <span>Ativar esta opção</span></label>`;
        } else if (campo.tipo_campo === "integer" || campo.tipo_campo === "number") {
            htmlCampos += `<input type="number" id="${idUnico}" class="input-moderno" placeholder="Digite o número..." oninput="atualizarTudo()">`;
        } else if (campo.tipo_campo === "text" || campo.tipo_campo === "inputfield") {
            htmlCampos += `<input type="text" id="${idUnico}" class="input-moderno" placeholder="Preencha o campo..." oninput="atualizarTudo()">`;
        } else if (campo.dropdown_itens && campo.dropdown_itens.length > 0) {
            htmlCampos += `<select id="${idUnico}" class="input-moderno" onchange="atualizarTudo()"><option value="">-- Selecione --</option>`;
            campo.dropdown_itens.forEach(item => {
                htmlCampos += `<option value="${item.valor_opcao}">${item.valor_opcao}</option>`;
            });
            htmlCampos += `</select>`;
        }

        htmlCampos += `</div>`;

        if (modoEdicaoAtivo) {
            htmlCampos += `<button class="btn-top" onclick="iniciarEdicaoDeCampo(${campo.id})" style="margin-top: 5px; width:100%;">✏️ Editar Propriedades</button>`;
        }

        divBox.innerHTML = htmlCampos;
        container.appendChild(divBox);
    });
    verificarRegrasOcultamento();
}

let timeout;
function atualizarTudo() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        verificarRegrasOcultamento();
        calcularProbabilidadesDoBanco();
        gerarTextoDoBanco();
        atualizarPreviewInline();
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
    if (modoEdicaoAtivo) {
        btn.textContent = "⚙️ Modo Edição: ON";
        btn.style.backgroundColor = "orange";
        btn.style.color = "black";
        sortableCamposInstance.option("disabled", false);
    } else {
        btn.textContent = "⚙️ Modo Edição: OFF";
        btn.style.backgroundColor = "";
        btn.style.color = "";
        sortableCamposInstance.option("disabled", true);
    }
    renderizarCamposDinamicosFormulario();
}

function gerarId(nome) {
    return "campo_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_");
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

function copiarTexto() {
    const texto = document.getElementById("resultado");
    texto.select();
    document.execCommand("copy");
    const toast = document.getElementById("toastCopia");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

function limparPagina() {
    document.querySelectorAll("#camposDinamicos input, #camposDinamicos select").forEach(el => {
        if (el.type === "checkbox") el.checked = false;
        else el.value = "";
    });
    atualizarTudo();
}

function exibirFormCriarCategoria() { document.getElementById("areaCriarCategoria").style.display = "block"; }
function fecharFormCriarCategoria() {
    document.getElementById("areaCriarCategoria").style.display = "none";
    document.getElementById("newCatNome").value = "";
}

async function salvarNovaCategoriaBanco() {
    const nome = document.getElementById("newCatNome").value.trim();
    if (!nome) return;
    const { error } = await supabaseClient.from('categorias').insert([{ nome }]);
    if (!error) {
        fecharFormCriarCategoria();
        await carregarCategoriasDoBanco();
    }
}

function exibirFormCriarOpcao() {
    idSendoEditado = null;
    document.getElementById("tituloFormOpcao").textContent = "📝 Registrar Opção / Pergunta";
    document.getElementById("areaCriarOpcao").style.display = "block";
    document.getElementById("regTipoCampo").value = "";
    document.getElementById("containerPassosDinamicos").style.display = "none";
    configurarFluxoRegistro();
}

function fecharFormCriarOpcao() {
    document.getElementById("areaCriarOpcao").style.display = "none";
    idSendoEditado = null;
    atualizarTudo();
}

function configurarFluxoRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    const container = document.getElementById("containerPassosDinamicos");
    if (!tipo) { container.style.display = "none"; return; }
    container.style.display = "block";
}

function calcularProbabilidadesDoBanco() {
    const painel = document.getElementById("painelSugestoes");
    const lista = document.getElementById("listaSugestoes");
    let contadores = {};

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        let ativo = false;
        if (el.type === "checkbox" && el.checked) ativo = true;
        if ((el.type === "text" || el.type === "number" || el.tagName === "SELECT") && el.value !== "") ativo = true;

        if (ativo && campo.regras_natureza) {
            campo.regras_natureza.forEach(regra => {
                const natObj = listaMapeadaNaturezasCopom.find(n => n.id === regra.natureza_id);
                if (natObj) {
                    contadores[natObj.natureza] = (contadores[natObj.natureza] || 0) + 1;
                }
            });
        }
    });

    const ordenado = Object.entries(contadores).sort((a, b) => b[1] - a[1]);
    if (ordenado.length > 0) {
        painel.style.display = "block";
        lista.innerHTML = ordenado.map(o => `<li><strong>${o[0]}</strong></li>`).join("");
    } else {
        painel.style.display = "none";
    }
}

function gerarTextoDoBanco() {
    const txtResultado = document.getElementById("resultado");
    if (!txtResultado) return;

    let partesTexto = [];
    let perguntasOrdenadas = [...perguntasDaCategoriaAtual].sort((a, b) => (a.ordem_contexto || 0) - (b.ordem_contexto || 0));

    perguntasOrdenadas.forEach(p => {
        const id = gerarId(p.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        let textoGerado = "";
        if (el.type === "checkbox" && el.checked) textoGerado = p.texto_output;
        else if (el.type === "number" && el.value !== "") textoGerado = p.texto_output?.replace("{valor}", el.value);
        else if (el.type === "text" && el.value !== "") textoGerado = p.texto_output?.replace("{valor}", el.value.toUpperCase());
        else if (el.tagName === "SELECT" && el.value) {
            const opt = p.dropdown_itens?.find(o => o.valor_opcao === el.value);
            if (opt) textoGerado = opt.texto_output;
        }

        if (textoGerado) {
            if (p.forcar_quebra_linha && partesTexto.length > 0) {
                partesTexto.push("\n" + textoGerado.trim());
            } else {
                partesTexto.push(textoGerado.trim());
            }
        }
    });

    txtResultado.value = partesTexto.join(" ").replace(/\s*\n\s*/g, "\n").trim();
}

function atualizarPreviewInline() { }
function recalcularOrdemPorPosicaoFisica() { }
function filtrarNaturezasAutocomplete() { }
function atualizarCamposDuranteCriacaoLocal() { }
function configurarSubtipoDropdown() { }
function alternarEscopoDeNaturezasVinculadas() { }