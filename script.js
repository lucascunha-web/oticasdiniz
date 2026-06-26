import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwE1WFYWOHBZPXhapa-td7NxA3Ndx-P2w",
  authDomain: "diniz-5e4af.firebaseapp.com",
  projectId: "diniz-5e4af",
  storageBucket: "diniz-5e4af.firebasestorage.app",
  messagingSenderId: "473285890866",
  appId: "1:473285890866:web:3715d02b32fac942a37d2b",
  measurementId: "G-4HBMBK0GWD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

const form = document.getElementById("loginForm");
const loginInput = document.getElementById("login");
const passwordInput = document.getElementById("password");
const message = document.getElementById("loginMessage");
const submitButton = form.querySelector("button[type='submit']");

loginInput.addEventListener("input", () => {
  const cursorPosition = loginInput.selectionStart;
  loginInput.value = loginInput.value.toUpperCase();
  loginInput.setSelectionRange(cursorPosition, cursorPosition);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const login = loginInput.value.trim().toUpperCase();
  const password = passwordInput.value.trim();

  if (!login || !password) {
    showMessage("Preencha login e senha.", "error");
    return;
  }

  setLoading(true);
  showMessage("Verificando acesso...", "");

  try {
    const userRef = doc(db, "usuarios", login);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showMessage("Login ou senha incorretos.", "error");
      return;
    }

    const userData = userSnap.data();
    const savedPassword = String(userData.senha ?? "");

    if (savedPassword !== password) {
      showMessage("Login ou senha incorretos.", "error");
      return;
    }

    sessionStorage.setItem("usuarioLogado", login);
    sessionStorage.setItem("usuarioCargo", userData.cargo ?? "");
    sessionStorage.setItem("usuarioLoja", userData.loja ?? "");

    showMessage("Login realizado com sucesso.", "success");
    window.setTimeout(() => {
      window.location.href = "painel.html";
    }, 260);
  } catch (error) {
    console.error("Erro ao verificar login:", error);
    showMessage("Nao foi possivel verificar o login agora.", "error");
  } finally {
    setLoading(false);
  }
});

function showMessage(text, type) {
  message.textContent = text;
  message.className = `login-message ${type}`.trim();
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Verificando..." : "Acessar portal";
}
