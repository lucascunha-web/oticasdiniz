async function fazerLogin() {
    const userField = document.getElementById('user');
    const passField = document.getElementById('pass');
    const mensagem = document.getElementById('mensagem');
    const btn = document.getElementById('btnLogin');

    const user = userField.value.trim();
    const pass = passField.value.trim();
    

    if (!user || !pass) {
        mensagem.innerText = "Preencha todos os campos!";
        mensagem.style.color = "#FFD700"; // Amarelo para aviso
        return;
    }

    // Início do carregamento visual
    btn.disabled = true;
    btn.innerText = "AUTENTICANDO...";
    mensagem.innerText = "";

    // SUBSTITUA PELA SUA URL DO GOOGLE APPS SCRIPT
    const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbxBtChCeNfo9y7x-8M1f0J8ByG1FnKAMjqcaUhUF92Y1gIpjnLk0d_3HDwrl3S3XpTE/exec"; 

    try {
        // Monta a URL com os parâmetros que seu Apps Script exige
        const endpoint = `${URL_SCRIPT}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
        
        const response = await fetch(endpoint);
        const data = await response.json();

        if (data.status === "success") {
            mensagem.style.color = "#00FF00"; // Verde
            mensagem.innerText = "Sucesso! Entrando...";

            // Salva os dados retornados (Cardápios, Vendas e Nível) para usar no Painel
            sessionStorage.setItem("usuarioLogado", JSON.stringify(data.usuario));
            sessionStorage.setItem("cardapios", JSON.stringify(data.cardapios));
            sessionStorage.setItem("vendas", JSON.stringify(data.vendas));

            // Redireciona para o seu painel após 1 segundo
            setTimeout(() => {
                window.location.href = "painel.html"; 
            }, 1000);

        } else {
            mensagem.style.color = "#FFFFFF"; // Branco para destacar no vermelho
            mensagem.innerText = data.message || "Usuário ou senha inválidos";
            btn.disabled = false;
            btn.innerText = "ENTRAR";
        }
    } catch (error) {
        console.error("Erro no login:", error);
        mensagem.innerText = "Erro de conexão com o servidor.";
        btn.disabled = false;
        btn.innerText = "ENTRAR";
    }
}