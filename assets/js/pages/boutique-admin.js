(function(window){
  'use strict';

  const FTS = window.FTS = window.FTS || {};
  let db = null;
  let products = {};

  const $ = id => document.getElementById(id);
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const euro = c => (Number(c || 0) / 100).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });

  function worker() {
    return String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/, '');
  }

  async function token() {
    return firebase.auth().currentUser.getIdToken(true);
  }

  async function api(path, opts) {
    const res = await fetch(worker() + path, Object.assign({
      headers: {
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + await token()
      }
    }, opts || {}));
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  function msg(t, ok = true) {
    const el = $('shop-msg');
    if (el) {
      el.textContent = t;
      el.className = 'shop-msg ' + (ok ? 'ok' : 'bad');
      setTimeout(() => { el.textContent = ''; }, 2600);
    }
  }

  function uploadStatus(text, ok = true) {
    const el = $('shop-upload-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'shop-upload-status ' + (ok ? 'ok' : 'bad');
  }

  function updatePreview(url) {
    const box = $('shop-image-preview');
    if (!box) return;
    const clean = String(url || '').trim();
    if (!clean) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = `<img src="${esc(clean)}" alt="Aperçu image article"/><span>Aperçu de l’image boutique</span>`;
  }

  function reset() {
    ['p-id','p-name','p-description','p-price','p-stock','p-category','p-order','p-image','p-variants'].forEach(id => { $(id).value = ''; });
    const file = $('p-image-file');
    if (file) file.value = '';
    $('p-active').checked = true;
    uploadStatus('');
    updatePreview('');
  }

  function fill(p) {
    $('p-id').value = p.id || '';
    $('p-name').value = p.name || '';
    $('p-description').value = p.description || '';
    $('p-price').value = p.priceCents ? String(Number(p.priceCents) / 100) : '';
    $('p-stock').value = p.stock || '';
    $('p-category').value = p.category || '';
    $('p-order').value = p.order || '';
    $('p-image').value = p.imageUrl || '';
    $('p-variants').value = p.variantsText || '';
    $('p-active').checked = p.active !== false;
    const file = $('p-image-file');
    if (file) file.value = '';
    uploadStatus('');
    updatePreview(p.imageUrl || '');
  }

  function render() {
    const box = $('shop-products');
    const rows = Object.entries(products)
      .map(([id, p]) => Object.assign({ id }, p || {}))
      .sort((a, b) => Number(a.order || 999) - Number(b.order || 999) || String(a.name || '').localeCompare(String(b.name || ''), 'fr'));

    if (!rows.length) {
      box.innerHTML = '<div class="shop-empty">Aucun article pour le moment.</div>';
      return;
    }

    box.innerHTML = rows.map(p => `
      <article class="shop-product ${p.active === false ? 'off' : ''}" data-product="${esc(p.id)}">
        <div>${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt=""/>` : '<div class="shop-product-icon">🛍️</div>'}</div>
        <div>
          <strong>${esc(p.name || 'Article')}</strong>
          <span>${esc(p.category || 'Boutique')} · ${euro(p.priceCents)}</span>
          <small>${p.stock ? esc(p.stock) + ' en stock' : 'Stock non limité'}${p.active === false ? ' · masqué' : ''}</small>
        </div>
      </article>`).join('');

    box.querySelectorAll('[data-product]').forEach(el => {
      el.addEventListener('click', () => fill(products[el.getAttribute('data-product')] || {}));
    });
  }

  async function load() {
    const data = await api('/admin/catalog', { method:'GET' });
    products = data.products || {};
    render();
  }

  async function uploadImage() {
    const input = $('p-image-file');
    const file = input && input.files && input.files[0];

    if (!file) {
      uploadStatus('Choisis d’abord une image depuis ton appareil.', false);
      return;
    }

    if (!/^image\//.test(file.type || '')) {
      uploadStatus('Le fichier choisi n’est pas une image.', false);
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      uploadStatus('Image trop lourde. Essaie une image de moins de 8 Mo.', false);
      return;
    }

    if (!FTS.uploadCloudinary) {
      uploadStatus('Upload Cloudinary indisponible : fts-utils.js n’est pas chargé.', false);
      return;
    }

    try {
      uploadStatus('Upload 0%…');
      const url = await FTS.uploadCloudinary(file, pct => uploadStatus('Upload ' + pct + '%…'));
      $('p-image').value = url;
      updatePreview(url);
      uploadStatus('Image envoyée. Le lien est prêt à être enregistré.');
      msg('Image ajoutée à l’article');
    } catch (err) {
      console.warn(err);
      uploadStatus('Erreur upload : ' + err.message, false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      id: $('p-id').value.trim(),
      name: $('p-name').value.trim(),
      description: $('p-description').value.trim(),
      priceCents: Math.round(Number(String($('p-price').value || '0').replace(',', '.')) * 100),
      stock: Number($('p-stock').value || 0) || 0,
      category: $('p-category').value.trim(),
      order: Number($('p-order').value || 999) || 999,
      imageUrl: $('p-image').value.trim(),
      variantsText: $('p-variants').value.trim(),
      active: $('p-active').checked
    };

    try {
      await api('/admin/catalog/product', { method:'POST', body:JSON.stringify(payload) });
      msg('Article enregistré');
      reset();
      await load();
    } catch(err) {
      console.warn(err);
      msg('Erreur : ' + err.message, false);
    }
  }

  async function remove() {
    const id = $('p-id').value.trim();
    if (!id) return msg('Sélectionne un article', false);
    if (!confirm('Masquer cet article ?')) return;

    try {
      await api('/admin/catalog/product/delete', { method:'POST', body:JSON.stringify({ id }) });
      msg('Article masqué');
      reset();
      await load();
    } catch(err) {
      msg('Erreur : ' + err.message, false);
    }
  }

  function boot() {
    db = FTS.initFirebase();
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        location.href = 'auth.html';
        return;
      }

      const snap = await db.ref('fts_users/' + user.uid).once('value');
      const profile = snap.val() || {};

      if (String(profile.role || '').toLowerCase() !== 'admin') {
        location.href = 'membres.html';
        return;
      }

      $('shop-admin-loading').style.display = 'none';
      $('shop-admin-shell').hidden = false;
      $('shop-form').addEventListener('submit', save);
      $('shop-new').addEventListener('click', reset);
      $('shop-reset').addEventListener('click', reset);
      $('shop-delete').addEventListener('click', remove);
      $('shop-upload-image').addEventListener('click', uploadImage);
      $('p-image').addEventListener('input', e => updatePreview(e.target.value));
      $('p-image-file').addEventListener('change', () => uploadStatus('Image prête. Clique sur “Envoyer l’image”.'));

      await load().catch(e => {
        $('shop-admin-error').textContent = 'Impossible de charger le catalogue : ' + e.message;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
