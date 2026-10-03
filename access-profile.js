import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const validRoles = new Set([
  "admin",
  "administrador",
  "gerente",
  "vendedor",
  "estoquista",
  "estoque",
  "almoxarifado",
  "caixa"
]);

export async function loadVerifiedAccessProfile(auth, db) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;

  const profileSnapshot = await getDoc(doc(db, "acessos", user.uid));
  if (!profileSnapshot.exists()) return null;

  const data = profileSnapshot.data();
  const nomeUsuario = typeof data.nomeUsuario === "string" ? data.nomeUsuario.trim() : "";
  const cargo = typeof data.cargo === "string" ? data.cargo.trim() : "";
  const normalizedRole = cargo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    data.uid !== user.uid ||
    !nomeUsuario ||
    !validRoles.has(normalizedRole) ||
    typeof data.loja !== "string"
  ) {
    throw new Error("O perfil de acesso está ausente ou inválido.");
  }

  return {
    user,
    profile: {
      uid: user.uid,
      nomeUsuario,
      cargo,
      loja: data.loja.trim()
    }
  };
}
