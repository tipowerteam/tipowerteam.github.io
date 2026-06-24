// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://pzovfmlsmcyiupdxbwai.supabase.co";
const SUPABASE_KEY = "sb_publishable_bisQorN4Yz-WC3YAZTBsjA_HlPeI4h5";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dadosNaturezas = [];
let perguntasDaCategoriaAtual = [];
let listaMapeadaNaturezasCopom = []; // Cache local para autocomplete instantâneo
let naturezasVinculadasNoPainel = []; // IDs selecionados no painel admin

window.onload = async () => {
    if (localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
        const btn = document.getElementById("btnTema");
        if (btn) btn.textContent = "Modo Claro";
    }

    await carregarCategoriasDoBanco();
    await baixarEGuardarTodasAsNaturezas();

    // Tratamento do Dropdown Principal para apagar a opção "Selecione..." ao mudar
    const selectNatureza = document.getElementById("natureza");
    selectNatureza.addEventListener("change", (e) => {
        if (e.target.value !== "") {
            const primeiraOpcao = e.target.options[0];
            if (primeiraOpcao && primeiraOpcao.value === "") {
                primeiraOpcao.remove();
            }
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
        atualizarPreviewAdmin(); // Mantém o sincronismo dinâmico também ao preencher a tela principal
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
    atualizarPreviewAdmin();
}

function alternarCamposRegistro() {
    const tipo = document.getElementById("regTipoCampo").value;
    document.getElementById("areaDropdownExistenteConfig").style.display = tipo === 'dropdown_existente' ? 'block' : 'none';
    document.getElementById("areaDropdownNovoConfig").style.display = tipo === 'dropdown_novo' ? 'block' : 'none';
}

// ATALHOS INTUITIVOS DE CRIAÇÃO ➕
function abrirAdminComCategoria() {
    const principalCat = document.getElementById("natureza").value;
    if (principalCat) {
        document.getElementById("regCategoria").value = principalCat;
        atualizarDropdownsExistentesDaCategoria();
    }
    const painel = document.getElementById("painelAdmin");
    if (!painel.classList.contains("aberto")) painel.classList.add("aberto");
    atualizarPreviewAdmin();
}

function abrirAdminComDropdownExistente(perguntaId) {
    document.getElementById("regTipoCampo").value = "dropdown_existente";
    alternarCamposRegistro();

    const principalCat = document.getElementById("natureza").value;
    if (principalCat) {
        document.getElementById("regCategoria").value = principalCat;
        atualizarDropdownsExistentesDaCategoria().then(() => {
            document.getElementById("regDropdownMae").value = perguntaId;
        });
    }

    const painel = document.getElementById("painelAdmin");
    if (!painel.classList.contains("aberto")) painel.classList.add("aberto");
    atualizarPreviewAdmin();
}

// PREVIEW REAL-TIME DA POSIÇÃO E FRASE NO PAINEL ADMIN
function atualizarPreviewAdmin() {
    const previewContainer = document.getElementById("previewTextoAdmin");
    if (!previewContainer) return;

    const textoOutputDigitado = document.getElementById("regTextoOutput").value.trim();
    const ordemDigitada = parseInt(document.getElementById("regOrdem").value) || 10;
    const tipoCampo = document.getElementById("regTipoCampo").value;

    let fragmentosFrase = [];

    // 1. Pega tudo que já está ativado/preenchido na tela principal
    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.texto_output) {
                fragmentosFrase.push({ texto: opt.texto_output, ordem: opt.ordem_contexto || 10, target: false });
            }
        }
        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.texto_output_true) {
                fragmentosFrase.push({ texto: campo.texto_output_true, ordem: campo.ordem_contexto_true || 10, target: false });
            }
        }
        if ((campo.tipo_campo === "numero" || campo.tipo_campo === "texto") && el.value) {
            const txtBase = campo.tipo_campo === "numero" ? campo.texto_output_numero : campo.texto_output_true;
            const ordemBase = campo.tipo_campo === "numero" ? campo.ordem_contexto_numero : campo.ordem_contexto_true;
            if (txtBase) {
                const txtPronto = txtBase.replace("{valor}", el.value);
                fragmentosFrase.push({ texto: txtPronto, ordem: ordemBase || 10, target: false });
            }
        }
    });

    // 2. Injeta a opção que está sendo configurada AGORA pelo atendente
    if (textoOutputDigitado) {
        let textoSimulado = textoOutputDigitado;
        if (tipoCampo === 'numero' || tipoCampo === 'texto') {
            textoSimulado = textoOutputDigitado.includes("{valor}") ? textoOutputDigitado.replace("{valor}", "X") : `${textoOutputDigitado} [X]`;
        }
        fragmentosFrase.push({ texto: textoSimulado, ordem: ordemDigitada, target: true });
    }

    if (fragmentosFrase.length === 0) {
        previewContainer.innerHTML = "<em>Digite a descrição para ver a simulação...</em>";
        return;
    }

    // 3. Ordena tudo com base nas prioridades dinâmicas
    fragmentosFrase.sort((a, b) => a.ordem - b.ordem);

    // 4. Monta o HTML destacando visualmente onde a nova opção vai entrar
    previewContainer.innerHTML = fragmentosFrase.map(f => {
        if (f.target) {
            return `<span class="highlight-new-option" title="Prioridade: ${f.ordem}">${f.texto}</span>`;
        }
        return `<span>${f.texto}</span>`;
    }).join(" ");
}

async function baixarEGuardarTodasAsNaturezas() {
    try {
        let { data, error } = await supabaseClient
            .from('naturezas_copom')
            .select('id, natureza');

        if (error) throw error;
        listaMapeadaNaturezasCopom = data || [];
    } catch (err) {
        console.error("Erro ao carregar naturezas para autocomplete:", err);
    }
}

function filtrarNaturezasAutocomplete(termoBusca) {
    const painel = document.getElementById("painelSugestoesInstantes");
    if (!termoBusca || termoBusca.trim().length < 1) {
        painel.style.display = "none";
        return;
    }

    const termoLimpo = termoBusca.toUpperCase();
    const filtradas = listaMapeadaNaturezasCopom.filter(nat =>
        nat.natureza && nat.natureza.toUpperCase().includes(termoLimpo)
    );

    painel.innerHTML = "";
    if (filtradas.length === 0) {
        painel.innerHTML = '<div class="item-sugestao">Nenhuma correspondência...</div>';
    } else {
        filtradas.slice(0, 10).forEach(nat => {
            const div = document.createElement("div");
            div.className = "item-sugestao";
            div.textContent = nat.natureza;
            div.style.padding = "8px";
            div.style.cursor = "pointer";
            div.onclick = () => {
                vincularNaturezaAdmin(nat.id, nat.natureza);
            };
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
            li.innerHTML = `${natObj.natureza} <button class="btn-remover-tag" onclick="removerNaturezaAdmin(${id})">&times;</button>`;
            ul.appendChild(li);
        }
    });
}

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

async function salvarNovoRegistroCompleto() {
    // Campo de colaborador estático por enquanto para satisfazer a constraint, até a inserção da Auth.
    const colaborador = "Atendente Autenticado";
    const categoriaId = document.getElementById("regCategoria").value;
    const nomeCampo = document.getElementById("regNomeCampo").value.trim();
    const tipoCampo = document.getElementById("regTipoCampo").value;
    const textoOutput = document.getElementById("regTextoOutput").value.trim();
    const ordem = parseInt(document.getElementById("regOrdem").value) || 10;

    if (!categoriaId || !nomeCampo || !textoOutput) {
        alert("Preencha todos os campos da opção!");
        return;
    }
    if (naturezasVinculadasNoPainel.length === 0) {
        alert("Vincule ao menos uma natureza usando o campo de busca!");
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
            const valorInicial = document.getElementById("regValorOpcaoNovo").value.trim() || "Padrão";
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
            const valorSubOpcao = document.getElementById("regValorOpcao").value.trim();

            if (!perguntaIdMae || !valorSubOpcao) {
                alert("Selecione o dropdown e defina o valor da opção!");
                return;
            }

            const { data: novaOpt, error: err } = await supabaseClient
                .from('opcoes_dropdown')
                .insert([{
                    pergunta_id: perguntaIdMae,
                    valor_opcao: valorSubOpcao,
                    texto_output: textoOutput,
                    ordem_contexto: ordem,
                    registrado_por: colaborador
                }]).select();

            if (err) throw err;

            for (const nId of naturezasVinculadasNoPainel) {
                await supabaseClient.from('vinculos_pesos').insert([{ opcao_dropdown_id: novaOpt[0].id, natureza_id: nId }]);
            }
        }

        alert(`Sucesso! Opção catalogada com segurança.`);
        document.getElementById("regNomeCampo").value = "";
        document.getElementById("regTextoOutput").value = "";
        naturezasVinculadasNoPainel = [];
        renderizarTagsNaturezas();
        alternarPainelAdmin();
        await atualizarCamposDoBanco();

    } catch (e) {
        console.error(e);
        alert("Erro ao gravar dados no Supabase.");
    }
}

async function carregarCategoriasDoBanco() {
    try {
        let { data, error } = await supabaseClient.from('categorias').select('*').order('id', { ascending: true });
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
        let { data: perguntas, error: errP } = await supabaseClient
            .from('perguntas')
            .select('*')
            .eq('categoria_id', categoriaId)
            .order('id', { ascending: true });

        if (errP) throw errP;
        perguntasDaCategoriaAtual = perguntas || [];

        for (let campo of perguntasDaCategoriaAtual) {
            if (campo.tipo_campo === "dropdown") {
                let { data: opcoes } = await supabaseClient
                    .from('opcoes_dropdown')
                    .select('*')
                    .eq('pergunta_id', campo.id);
                campo.opcoes_dropdown = opcoes || [];
            }

            let { data: vPesos } = await supabaseClient
                .from('vinculos_pesos')
                .select('natureza_id, naturezas_copom(natureza)')
                .eq('pergunta_id', campo.id);
            campo.vinculos_pesos = vPesos || [];

            if (campo.opcoes_dropdown) {
                for (let opt of campo.opcoes_dropdown) {
                    let { data: vOptPesos } = await supabaseClient
                        .from('vinculos_pesos')
                        .select('natureza_id, naturezas_copom(natureza)')
                        .eq('opcao_dropdown_id', opt.id);
                    opt.vinculos_pesos = vOptPesos || [];
                }
            }

            const divGroup = document.createElement("div");
            divGroup.className = "input-group-dinamico";
            const id = gerarId(campo.nome_campo);

            // Container do Rótulo + Botão rápido ➕
            const labelContainer = document.createElement("div");
            labelContainer.className = "header-container-opcao";

            const label = document.createElement("label");
            label.textContent = campo.nome_campo;
            label.htmlFor = id;
            labelContainer.appendChild(label);

            // Se for do tipo dropdown, injeta o atalho rápido ➕ ao lado
            if (campo.tipo_campo === "dropdown") {
                const btnAdd = document.createElement("button");
                btnAdd.className = "btn-atalho-add";
                btnAdd.textContent = "➕";
                btnAdd.title = "Adicionar nova opção a este dropdown";
                btnAdd.onclick = (e) => {
                    e.preventDefault();
                    abrirAdminComDropdownExist(campo.id);
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
                        if (primeiraOpcao && primeiraOpcao.value === "") {
                            primeiraOpcao.remove();
                        }
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
                if (campo.tipo_campo === "numero") input.min = "0";
                input.addEventListener("input", atualizarTudo);
                divGroup.appendChild(input);
            }

            container.appendChild(divGroup);
        }
    } catch (erro) {
        console.error("Erro ao estruturar campos dinâmicos:", erro);
    }
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
                opt.vinculos_pesos.forEach(v => {
                    if (v.naturezas_copom && v.naturezas_copom.natureza) arrayVotosNaturezas.push(v.naturezas_copom.natureza);
                });
            }
        }

        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.vinculos_pesos) {
                campo.vinculos_pesos.forEach(v => {
                    if (v.naturezas_copom && v.naturezas_copom.natureza) arrayVotosNaturezas.push(v.naturezas_copom.natureza);
                });
            }
        }

        if ((campo.tipo_campo === "numero" || campo.tipo_campo === "texto") && el.value.trim() !== "") {
            if (campo.vinculos_pesos) {
                campo.vinculos_pesos.forEach(v => {
                    if (v.naturezas_copom && v.naturezas_copom.natureza) arrayVotosNaturezas.push(v.naturezas_copom.natureza);
                });
            }
        }
    });

    const lista = document.getElementById("listaSugestoes");
    if (!lista) return;
    lista.innerHTML = "";

    const totalDeVotosAtivos = arrayVotosNaturezas.length;

    if (totalDeVotosAtivos > 0) {
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

    if (!categoriaTexto || !perguntasDaCategoriaAtual.length) return;

    let fragmentosFrase = [];

    perguntasDaCategoriaAtual.forEach(campo => {
        const id = gerarId(campo.nome_campo);
        const el = document.getElementById(id);
        if (!el) return;

        if (campo.tipo_campo === "dropdown" && el.value) {
            const opt = campo.opcoes_dropdown?.find(o => o.valor_opcao === el.value);
            if (opt && opt.texto_output) {
                fragmentosFrase.push({ texto: opt.texto_output, ordem: opt.ordem_contexto || 10 });
            }
        }

        if (campo.tipo_campo === "bool" && el.checked) {
            if (campo.texto_output_true) {
                fragmentosFrase.push({ texto: campo.texto_output_true, ordem: campo.ordem_contexto_true || 10 });
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
        setTimeout(() => {
            toast.classList.remove("visivel");
        }, 2000);
    }
}

async function limparPagina() {
    document.getElementById("resultado").value = "";
    document.getElementById("camposDinamicos").innerHTML = "";
    document.getElementById("painelSugestoes").style.display = "none";
    perguntasDaCategoriaAtual = [];
    await carregarCategoriasDoBanco();
}

function gerarId(texto) {
    return texto.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/__+/g, "_");
}