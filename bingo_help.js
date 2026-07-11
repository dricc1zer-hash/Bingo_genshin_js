// Bingo Help Button - Fichier séparé pour ne pas casser les autres modes
async function showBingoHelp() {
  try {
    const response = await fetch("HELP_bingo.txt");
    if (!response.ok) throw new Error("Fichier d'aide introuvable");
    const helpText = await response.text();
    showMessage("Aide", helpText);
  } catch (error) {
    showMessage("Erreur", "Impossible de charger le fichier d'aide.\n" + error.message);
  }
}

// Ajouter l'event listener quand le DOM est prêt
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const helpBtn = document.getElementById("help-bingo-btn");
    if (helpBtn) {
      helpBtn.addEventListener("click", showBingoHelp);
    }
  });
} else {
  const helpBtn = document.getElementById("help-bingo-btn");
  if (helpBtn) {
    helpBtn.addEventListener("click", showBingoHelp);
  }
}