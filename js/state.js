// ============================================================
//  EPPRIDAD — État global centralisé v1.0
//  Charger après config.js, avant tous les autres scripts
// ============================================================

window.EPPRIDAD_STATE = {
  session:          null,
  etudiantActuel:   null,
  impersonating:    false,
  validateId:       null,
  cours: {
    formationId:  null,
    modules:      [],
    moduleIdx:    0,
    onglet:       'cours',
    quizResults:  {}
  },
  adminData: {
    comptes:       [],
    inscriptions:  [],
    formations:    [],
    commandes:     []
  },
  panelHistory:     [],
  pwaPrompt:        null,
  libFilter:        'all',
  adminPostType:    'actu',
  adminPostImgFile: null,
  editingProductId: null,
  prodImgBase64:    null
};

// Raccourci global pour compatibilité rétroactive
var _s = null;
