(function () {
  window.MT_PHOTO_UI = function (onMatch, onChange) {
    const $ = (id) => document.getElementById(id), O = window.MT_OPTIONS;
    let stream = null, source = null, face = null, generation = 0;
    const status = (s) => { $('photo-status').textContent = s; };
    function stop() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; $('photo-video').srcObject = null; $('photo-video').hidden = true; $('photo-capture').hidden = true; }
    function discard() { generation++; stop(); if (source) source.width = source.height = 0; source = null; $('photo-preview').width = $('photo-preview').height = 0; $('photo-preview').hidden = true; $('photo-choices').hidden = true; document.querySelector('.photo-frame').hidden = true; $('photo-file').value = ''; }
    function preview(image) {
      if (!$('photo-consent').checked) return;
      const w = image.videoWidth || image.width, h = image.videoHeight || image.height, side = Math.min(w, h);
      source = document.createElement('canvas'); source.width = source.height = 256;
      source.getContext('2d').drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 256, 256);
      stop(); const cv = $('photo-preview'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(source, 0, 0);
      cv.hidden = false; $('photo-choices').hidden = false; document.querySelector('.photo-frame').hidden = false; status('Preview only. Choose how this device should use the photo.');
    }
    $('photo-consent').onchange = () => { discard(); $('photo-file').disabled = $('photo-camera').disabled = !$('photo-consent').checked; if (!$('photo-consent').checked) { face = null; $('photo-remove').hidden = true; onChange(); } status(''); };
    $('photo-camera').onclick = async () => {
      discard(); const id = generation;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status('This network address cannot open a live camera. Use Choose File / Take Photo below; manual customization also works.'); $('photo-file').click(); return; }
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 }, audio: false });
        if (id !== generation || !$('photo-consent').checked) { media.getTracks().forEach((t) => t.stop()); return; }
        stream = media; $('photo-video').srcObject = media; $('photo-video').hidden = false; $('photo-capture').hidden = false; document.querySelector('.photo-frame').hidden = false;
        status('Camera is on for this preview only.');
      } catch { status('Camera permission was declined or unavailable. Choose a photo or continue manually.'); }
    };
    $('photo-capture').onclick = () => { if (stream && $('photo-video').videoWidth) preview($('photo-video')); };
    $('photo-file').onchange = async () => {
      const file = $('photo-file').files[0], id = ++generation; if (!file || !$('photo-consent').checked) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { status('Choose a JPEG, PNG or WebP under 10 MB.'); $('photo-file').value = ''; return; }
      let bitmap; try { bitmap = await createImageBitmap(file, { resizeWidth: 640, resizeQuality: 'high' }); if (id === generation && $('photo-consent').checked) preview(bitmap); } catch { status('The photo could not be read. Manual controls remain available.'); } finally { if (bitmap) bitmap.close(); $('photo-file').value = ''; }
    };
    $('photo-match').onclick = () => {
      if (!source) return; const pixels = source.getContext('2d').getImageData(0, 0, 256, 256).data;
      const match = { hairColor: MT_PHOTO.nearest(MT_PHOTO.sample(pixels, 256, 256, .5, .18), O.hairColor), skin: MT_PHOTO.nearest(MT_PHOTO.sample(pixels, 256, 256, .5, .42), O.skins) };
      pixels.fill(0); discard(); onMatch(match); status('Approximate skin and hair colors matched. Photo discarded. Choose hairstyle and features manually.');
    };
    $('photo-face').onclick = () => {
      if (!source) return; face = document.createElement('canvas'); face.width = 16; face.height = 16;
      face.getContext('2d').drawImage(source, 64, 57, 128, 144, 0, 0, 16, 16);
      discard(); $('photo-remove').hidden = false; onChange(); status('Pixel face is visible only in your phone preview until this page closes. Nothing was uploaded.');
    };
    $('photo-retake').onclick = () => { discard(); status('Photo discarded. Open camera or choose another photo.'); };
    $('photo-remove').onclick = () => { if (face) face.width = face.height = 0; face = null; $('photo-remove').hidden = true; onChange(); status('Face removed.'); };
    document.querySelector('#photo-panel').addEventListener('toggle', (e) => { if (!e.target.open) discard(); });
    window.addEventListener('pagehide', () => { discard(); if (face) face.width = face.height = 0; face = null; });
    return { decorate: (av) => face ? { ...av, faceSprite: face } : av };
  };
})();
