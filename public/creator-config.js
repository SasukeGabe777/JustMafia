// Character creator layout. Each tab lists sections; each section edits one
// avatar field from MT_OPTIONS.AVATAR_FIELDS.
//
// To add a customization option:
//   1. add its option list in public/shared/options.js and one line in AVATAR_FIELDS
//      (the server then validates and saves it automatically);
//   2. draw it in public/character-art.js;
//   3. add a section below.
//
// Section fields:
//   field      avatar key being edited
//   label      heading shown above the choices
//   kind       'swatch' (color chips) or 'tile' (rendered thumbnails)
//   focus      tile camera: 'head' | 'hat' | 'body' | 'feet' | 'house' (tiles only)
//   random     true if "Randomize" may change it
(function (root) {
  const TABS = [
    { id: 'body', label: 'Body', icon: '🧍', sections: [
      { field: 'skin', label: 'Skin tone', kind: 'swatch', random: true },
      { field: 'face', label: 'Face shape', kind: 'tile', focus: 'head', random: true },
    ] },
    { id: 'face', label: 'Face', icon: '🙂', sections: [
      { field: 'expression', label: 'Expression', kind: 'tile', focus: 'head', random: true },
      { field: 'eyes', label: 'Eye color', kind: 'swatch', random: true },
      { field: 'features', label: 'Face markings', kind: 'tile', focus: 'head', random: true },
      { field: 'facialHair', label: 'Facial hair', kind: 'tile', focus: 'head', random: true },
    ] },
    { id: 'hair', label: 'Hair', icon: '💇', sections: [
      { field: 'hair', label: 'Hairstyle', kind: 'tile', focus: 'hat', random: true },
      { field: 'hairColor', label: 'Hair color', kind: 'swatch', random: true },
    ] },
    { id: 'clothes', label: 'Clothes', icon: '👕', sections: [
      { field: 'outfit', label: 'Outfit', kind: 'tile', focus: 'body', random: true },
      { field: 'color', label: 'Clothing color', kind: 'swatch', random: true },
      { field: 'pants', label: 'Pants color', kind: 'swatch', random: true },
      { field: 'shoeStyle', label: 'Footwear', kind: 'tile', focus: 'feet', random: true },
      { field: 'shoes', label: 'Shoe color', kind: 'swatch', random: true },
    ] },
    { id: 'accessories', label: 'Extras', icon: '🎩', sections: [
      { field: 'hat', label: 'Hat', kind: 'tile', focus: 'hat', random: true },
      { field: 'accessory', label: 'Accessory', kind: 'tile', focus: 'body', random: true },
      { field: 'nameColor', label: 'Name color', kind: 'swatch', random: true },
      { field: 'nameplate', label: 'Nameplate', kind: 'tile', focus: 'body' },
      { field: 'effect', label: 'Cosmetic effect', kind: 'tile', focus: 'body' },
    ] },
  ];
  // House designer (separate screen). Fields are MT_OPTIONS.HOME_FIELDS keys;
  // `list` names the option list. Tiles render the whole house with that choice.
  const HOME_TABS = [
    { id: 'style', label: 'Design', icon: '🏠', sections: [
      { field: 'style', list: 'houseStyle', label: 'House design', kind: 'tile', focus: 'house', catalog: 'houseStyle' },
    ] },
    { id: 'paint', label: 'Paint', icon: '🎨', sections: [
      { field: 'wall', list: 'houseColor', label: 'House color', kind: 'swatch' },
      { field: 'roof', list: 'roofColor', label: 'Roof color', kind: 'swatch' },
    ] },
    { id: 'door', label: 'Door', icon: '🚪', sections: [
      { field: 'door', list: 'doorStyle', label: 'Door', kind: 'tile', focus: 'house' },
      { field: 'windows', list: 'windowStyle', label: 'Windows', kind: 'tile', focus: 'house' },
    ] },
    { id: 'yard', label: 'Yard', icon: '🌻', sections: [
      { field: 'yard', list: 'yard', label: 'Yard decoration', kind: 'tile', focus: 'house' },
      { field: 'decor', list: 'houseDecor', label: 'Shop decoration', kind: 'tile', focus: 'house', catalog: 'houseDecor' },
    ] },
  ];
  root.MT_CREATOR_CONFIG = { TABS, HOME_TABS };
})(typeof window !== 'undefined' ? window : globalThis);
