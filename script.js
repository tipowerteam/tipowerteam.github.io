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

    let isDragging = false;

    resizer.addEventListener("mousedown", (e) => {
        isDragging = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        let novaLargura = e.clientX - colEsquerda.getBoundingClientRect().left;
        const larguraMaxPermitida = window.innerWidth * 0.55;
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

    document.addEventListener("click", function (e) {
        const painel = document.getElementById("painelSugestoesInstantes");
        const buscaInput = document.getElementById("buscaNatureza");
        if (painel && e.target !== buscaInput && !painel.contains(e.target)) {
            painel.innerHTML = "";
            painel.style.display = "none";
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
    const novaAltura = Math.min(elemento.scrollHeight, 400);
    elemento.style.height = novaAltura + "px";
}

async function baixarEGuardarTodasAsNaturezas() {
    try {
        const { data, error } = await supabaseClient.from('naturezas_copom').select('id, naturaleza');
        if (!error && data) {
            listaMapeadaNaturezasCopom = data.map(n => ({ id: n.id, natureza: n.naturaleza }));
        }
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
    popularSelectOcultoAte();
}

function popularSelectOcultoAte() {
    const selectOculto = document.getElementById("regOcultoAte");
    if (!selectOculto) return;
    selectOculto.innerHTML = '<option value="">Sempre Visível</option>';
    perguntasDaCategoriaAtual.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.nome_campo;
        opt.textContent = p.nome_campo;
        selectOculto.appendChild(opt);
    });
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

        if (campo.tipo_campo === "bool") {
            htmlCampos += `<label class="checkbox-container"><input type="checkbox" id="${idUnico}" onchange="atualizarTudo()"> <span>Ativar esta opção</span></label>`;
        } else if (campo.tipo_campo === "integer") {
            htmlCampos += `<input type="number" id="${idUnico}" class="input-moderno" placeholder="Digite o número..." oninput="atualizarTudo()">`;
        } else if (campo.tipo_campo === "inputfield") {
            htmlCampos += `<input type="text" id="${idUnico}" class="input-moderno" placeholder="Preencha o campo..." oninput="atualizarTudo()">`;
        } else if (campo.tipo_campo === "dropdown") {
            htmlCampos += `<select id="${idUnico}" class="input-moderno" onchange="atualizarTudo()"><option value="">-- Selecione --</option>`;
            if (campo.dropdown_itens) {
                campo.dropdown_itens.forEach(item => {
                    htmlCampos += `<option value="${item.valor_opcao}">${item.valor_opcao}</option>`;
                });
            }
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
        else if (el.type === "number" && el.value !== "") {
            if (p.regra_maior_que !== null && parseInt(el.value) <= p.regra_maior_que) return;
            textoGerado = p.texto_output?.replace("{valor}", el.value);
        }
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

// ==========================================
// IMPLEMENTAÇÃO DAS FUNÇÕES COMPLEMENTARES
// ==========================================

function configurarFluxoRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    const container = document.getElementById("containerPassosDinamicos");
    const blocoSubtipo = document.getElementById("blocoSubtipoDropdown");

    if (!tipo) { container.style.display = "none"; return; }
    container.style.display = "block";

    if (tipo === "dropdown") {
        blocoSubtipo.style.display = "block";
        popularDropdownsExistentesNoFormulario();
        configurarSubtipoDropdown();
    } else {
        blocoSubtipo.style.display = "none";
        document.getElementById("blocoNomeDropdownNovo").style.display = "none";
        document.getElementById("blocoDropdownExistente").style.display = "none";
        document.getElementById("labelNomeCampoGeral").textContent = "Título / Nome da Opção:";
    }
    atualizarPreviewInline();
}

function configurarSubtipoDropdown() {
    const subtipo = document.getElementById("regSubtipoDropdown").value;
    if (subtipo === "novo") {
        document.getElementById("blocoNomeDropdownNovo").style.display = "block";
        document.getElementById("blocoDropdownExistente").style.display = "none";
        document.getElementById("labelNomeCampoGeral").textContent = "Nome da Opção Interna (Item inicial):";
    } else {
        document.getElementById("blocoNomeDropdownNovo").style.display = "none";
        document.getElementById("blocoDropdownExistente").style.display = "block";
        document.getElementById("labelNomeCampoGeral").textContent = "Nome da Nova Opção Opcional:";
    }
    atualizarCamposDuranteCriacaoLocal();
}

function popularDropdownsExistentesNoFormulario() {
    const selectMae = document.getElementById("regDropdownMae");
    if (!selectMae) return;
    const existentes = perguntasDaCategoriaAtual.filter(p => p.tipo_campo === "dropdown");

    selectMae.innerHTML = '<option value="">-- Escolha o grupo --</option>';
    existentes.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.nome_campo;
        selectMae.appendChild(opt);
    });
}

function atualizarCamposDuranteCriacaoLocal() {
    atualizarPreviewInline();
}

function filtrarNaturezasAutocomplete(busca) {
    const painel = document.getElementById("painelSugestoesInstantes");
    if (!painel) return;

    if (!busca || !busca.trim()) {
        painel.innerHTML = "";
        painel.style.display = "none";
        return;
    }

    // Filtra ignorando maiúsculas/minúsculas
    const filtradas = listaMapeadaNaturezasCopom.filter(n =>
        n.natureza && n.natureza.toLowerCase().includes(busca.toLowerCase())
    ).slice(0, 5); // Limita a 5 resultados para não estourar o layout

    if (filtradas.length === 0) {
        painel.innerHTML = `<div style="padding: 10px; color: var(--texto-secundario); font-size: 13px;">Nenhuma natureza encontrada</div>`;
        painel.style.display = "block";
        return;
    }

    // Renderiza os itens injetando o ID e o Nome escapado corretamente
    painel.innerHTML = filtradas.map(n => {
        const nomeEscapado = n.natureza.replace(/'/g, "\\'");
        return `
            <div class="sugestao-item-busca" 
                 style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid var(--cor-borda); color: var(--texto-principal); background: var(--bg-card);" 
                 onclick="adicionarNaturezaAoPainel(${n.id}, '${nomeEscapado}')">
                ${n.natureza}
            </div>
        `;
    }).join("");

    painel.style.display = "block";
}

function adicionarNaturezaAoPainel(id, nome) {
    const isCondicional = document.getElementById("radioCondicional").checked;
    const listaAlvo = isCondicional ? naturezasCondicionaisNoPainel : naturezasVinculadasNoPainel;
    const ulDOM = document.getElementById(isCondicional ? "listaNaturezasCondicionais" : "listaNaturezasVinculadas");

    if (!listaAlvo.some(n => n.id === id)) {
        listaAlvo.push({ id, nome });

        const li = document.createElement("li");
        li.innerHTML = `${nome} <span style="color:var(--cor-perigo); cursor:pointer; margin-left:5px;" onclick="removerNaturezaDoPainel(${id}, ${isCondicional})">❌</span>`;
        li.setAttribute("data-id", id);
        ulDOM.appendChild(li);
    }

    document.getElementById("buscaNatureza").value = "";
    document.getElementById("painelSugestoesInstantes").innerHTML = "";
}

function removerNaturezaDoPainel(id, isCondicional) {
    if (isCondicional) {
        naturezasCondicionaisNoPainel = naturezasCondicionaisNoPainel.filter(n => n.id !== id);
        document.querySelector(`#listaNaturezasCondicionais li[data-id="${id}"]`)?.remove();
    } else {
        naturezasVinculadasNoPainel = naturezasVinculadasNoPainel.filter(n => n.id !== id);
        document.querySelector(`#listaNaturezasVinculadas li[data-id="${id}"]`)?.remove();
    }
}

function alternarEscopoDeNaturezasVinculadas() {
    const valorMaiorQue = document.getElementById("regValorMaiorQue").value;
    const blocoCondicionais = document.getElementById("blocoTagsCondicionais");
    const radioCondicional = document.getElementById("radioCondicional");

    if (valorMaiorQue !== "" && parseInt(valorMaiorQue) >= 0) {
        if (radioCondicional.checked) blocoCondicionais.style.display = "block";
        else blocoCondicionais.style.display = "none";
    } else {
        blocoCondicionais.style.display = "none";
    }
}

function atualizarPreviewInline() {
    const grid = document.getElementById("zonaPreviewArrastavel");
    const textoInput = document.getElementById("regTextoOutput").value.trim();
    const nomeCampo = document.getElementById("regNomeCampo").value.trim();
    const tipo = document.getElementById("regTipoCampo").value;

    if (!textoInput) {
        grid.innerHTML = '<div class="instrucoes-preview">Escreva algo no output para visualizar a ordem.</div>';
        return;
    }

    let textoFormatado = textoInput;
    if (tipo === "integer" || tipo === "inputfield") {
        textoFormatado = textoInput.replace("{valor}", " [VALOR DE ENTRADA] ");
    }

    grid.innerHTML = `
        <div class="bloco-preview-item" style="padding:10px; background:rgba(37,99,235,0.1); border:1px dashed var(--cor-primaria); border-radius:6px; cursor:move;">
            <strong>${nomeCampo || 'Opção'}:</strong> "${textoFormatado}"
        </div>
    `;
}

function recalcularOrdemPorPosicaoFisica() {
    // Ordem visual rearranjada localmente (mock dinâmico)
    ordemFicticiaAoArrastar = 10;
}

async function salvarNovoRegistroInline() {
    const categoriaId = document.getElementById("natureza").value;
    const tipoCampo = document.getElementById("regTipoCampo").value;
    const nomeCampo = document.getElementById("regNomeCampo").value.trim();
    const textoOutput = document.getElementById("regTextoOutput").value.trim();
    const forcarQuebra = document.getElementById("regQuebraLinha").checked;
    const ocultoAte = document.getElementById("regOcultoAte").value;
    const valorMaiorQue = document.getElementById("regValorMaiorQue").value;

    if (!categoriaId || !tipoCampo || !nomeCampo) {
        alert("Por favor, preencha Categoria, Tipo de Campo e Nome do Campo!");
        return;
    }

    try {
        const subtipo = document.getElementById("regSubtipoDropdown").value;

        if (tipoCampo === "dropdown" && subtipo === "existente") {
            const campoPaiId = document.getElementById("regDropdownMae").value;
            if (!campoPaiId) { alert("Selecione o dropdown alvo!"); return; }

            const { error: errDrop } = await supabaseClient.from('dropdown_itens').insert([{
                campo_id: parseInt(campoPaiId),
                valor_opcao: nomeCampo,
                texto_output: textoOutput
            }]);

            if (errDrop) throw errDrop;
            alert("Opção adicionada ao Dropdown existente!");
        } else {
            const proximaOrdem = (perguntasDaCategoriaAtual.length + 1) * 10;
            let finalNome = nomeCampo;

            if (tipoCampo === "dropdown" && subtipo === "novo") {
                finalNome = document.getElementById("regNomeDropdownNovo").value.trim() || nomeCampo;
            }

            const { data: novoCampo, error: errCampo } = await supabaseClient
                .from('campos_formulario')
                .insert([{
                    categoria_id: parseInt(categoriaId),
                    nome_campo: finalNome,
                    tipo_campo: tipoCampo,
                    texto_output: tipoCampo === "dropdown" ? "" : textoOutput,
                    forcar_quebra_linha: forcarQuebra,
                    ordem_exibicao: proximaOrdem,
                    ordem_contexto: proximaOrdem,
                    oculto_ate: ocultoAte || null,
                    regra_maior_que: valorMaiorQue !== "" ? parseInt(valorMaiorQue) : null
                }])
                .select()
                .single();

            if (errCampo) throw errCampo;

            if (tipoCampo === "dropdown" && subtipo === "novo") {
                await supabaseClient.from('dropdown_itens').insert([{
                    campo_id: novoCampo.id,
                    valor_opcao: nomeCampo,
                    texto_output: textoOutput
                }]);
            }

            if (naturezasVinculadasNoPainel.length > 0) {
                const insertsNormais = naturezasVinculadasNoPainel.map(n => ({
                    campo_id: novoCampo.id,
                    natureza_id: n.id,
                    condicional_maior_que: null
                }));
                await supabaseClient.from('regras_natureza').insert(insertsNormais);
            }

            if (naturezasCondicionaisNoPainel.length > 0 && valorMaiorQue !== "") {
                const insertsCondicionais = naturezasCondicionaisNoPainel.map(n => ({
                    campo_id: novoCampo.id,
                    natureza_id: n.id,
                    condicional_maior_que: parseInt(valorMaiorQue)
                }));
                await supabaseClient.from('regras_natureza').insert(insertsCondicionais);
            }

            alert("Novo campo registrado globalmente!");
        }

        // Reseta coleções de interface
        naturezasVinculadasNoPainel = [];
        naturezasCondicionaisNoPainel = [];
        document.getElementById("listaNaturezasVinculadas").innerHTML = "";
        document.getElementById("listaNaturezasCondicionais").innerHTML = "";
        document.getElementById("regNomeCampo").value = "";
        document.getElementById("regTextoOutput").value = "";

        fecharFormCriarOpcao();
        await atualizarCamposDoBanco();

    } catch (error) {
        console.error("Erro ao processar salvamento:", error);
        alert("Erro no salvamento: " + error.message);
    }
}