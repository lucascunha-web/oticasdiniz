import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { browserLocalPersistence, browserSessionPersistence, getAuth, setPersistence, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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
if (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
if (!window.__firebaseAppCheckInitialized) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("6LftKsgtAAAAANrwLKRA-fyJEw-ZKWsTPyTwz_KA"),
    isTokenAutoRefreshEnabled: true
  });
  window.__firebaseAppCheckInitialized = true;
}
const db = getFirestore(app);
const auth = getAuth(app);

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

function getAuthEmail(login) {
  const cleanLogin = String(login || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_.-]/g, "");
  return `${cleanLogin || "user"}@diniz.internal`;
}

function clearStoredIdentity() {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem("usuarioLogado");
    storage.removeItem("usuarioCargo");
    storage.removeItem("usuarioLoja");
  }
}

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

  const email = getAuthEmail(login);
  const authPassword = password.length < 6 ? password.padEnd(6, "0") : password;
  const rememberMe = document.querySelector('input[name="remember"]').checked;
  let authenticated = false;

  try {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, authPassword);
    authenticated = true;

    const profileRef = doc(db, "acessos", credential.user.uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    const profile = profileSnap.data();
    const nomeUsuario = typeof profile.nomeUsuario === "string" ? profile.nomeUsuario.trim() : "";
    const cargo = typeof profile.cargo === "string" ? profile.cargo.trim() : "";
    const loja = typeof profile.loja === "string" ? profile.loja.trim() : "";
    if (
      profile.uid !== credential.user.uid ||
      !nomeUsuario ||
      nomeUsuario.toUpperCase() !== login ||
      !cargo ||
      !Object.hasOwn(profile, "loja") ||
      typeof profile.loja !== "string"
    ) {
      throw new Error("PROFILE_INVALID");
    }

    const storage = sessionStorage;

    clearStoredIdentity();
    storage.setItem("usuarioLogado", nomeUsuario);
    storage.setItem("usuarioCargo", cargo);
    storage.setItem("usuarioLoja", loja);
    if (rememberMe) localStorage.setItem("usuarioLogado", nomeUsuario);
    
    showMessage("Login realizado com sucesso.", "success");
    window.setTimeout(() => {
      window.location.href = "painel.html";
    }, 260);
  } catch (error) {
    console.error("Erro ao verificar login:", error);
    if (authenticated) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Erro ao encerrar sessão sem perfil válido:", signOutError);
      }
      clearStoredIdentity();
    }

    if (error.message === "PROFILE_NOT_FOUND" || error.message === "PROFILE_INVALID") {
      showMessage("Perfil de acesso não encontrado ou inválido. Contate o administrador.", "error");
    } else if (error.code === "permission-denied") {
      showMessage("Sem permissão para carregar seu perfil. Verifique as regras da coleção acessos.", "error");
    } else if (authenticated) {
      showMessage("Não foi possível carregar seu perfil. Tente novamente.", "error");
    } else {
      showMessage("Login ou senha incorretos.", "error");
    }
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
