import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Coffee, Leaf, LogOut, Mail, MapPin, Menu, Save, Shield, Upload, X } from 'lucide-react';
import { auth, db, storage, firebaseReady } from './services/firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import './styles/app.css';

const defaultContent = {
  brand: 'Finca El Carmen',
  logo: '/el-carmen-logo.jpg',
  nav: ['Inicio', 'Historia', 'Café', 'Galería', 'Contacto'],
  hero: {
    title: 'Café de altura desde Salvias / Zaruma',
    subtitle: 'Una finca familiar dedicada a producir cafés especiales con identidad, trazabilidad y procesos cuidados.',
    cta: 'Conoce nuestros cafés',
    image: ''
  },
  story: {
    title: 'Nuestra historia',
    text: 'Finca El Carmen nace entre montañas, clima fresco y tradición cafetera. Nuestro objetivo es producir café con calidad, consistencia y respeto por el origen.',
    highlight: 'Altitud referencial: 1200 msnm'
  },
  identity: {
    eyebrow: 'Identidad',
    title: 'Producción con identidad',
    text: 'Trabajamos cada lote con trazabilidad, cuidado postcosecha y procesos diseñados para expresar el carácter de nuestra finca.'
  },
  coffees: [
    { name: 'Sidra Honey', process: 'Honey doble fermentación', notes: 'Chocolate, maracuyá, jamaica, regaliz', image: '' },
    { name: 'Típica Mejorado', process: 'Lavado experimental', notes: 'Nibs de cacao, melaza, durazno, jazmín', image: '' }
  ],
  gallery: [],
  contact: {
    title: 'Contáctanos',
    whatsapp: '+593 969859895',
    email: 'info@fincaelcarmen.com',
    location: 'Salvias / Zaruma, El Oro, Ecuador',
    instagram: '@fincaelcarmen',
    facebook: '',
    tiktok: '',
    website: ''
  },
  seo: {
    title: 'Finca El Carmen | Café especial de Zaruma',
    description: 'Café especial de altura producido en Finca El Carmen, Salvias / Zaruma, Ecuador.'
  }
};

function mergeContent(base, incoming = {}) {
  return {
    ...base,
    ...incoming,
    hero: { ...base.hero, ...(incoming.hero || {}) },
    story: { ...base.story, ...(incoming.story || {}) },
    identity: { ...base.identity, ...(incoming.identity || {}) },
    contact: { ...base.contact, ...(incoming.contact || {}) },
    seo: { ...base.seo, ...(incoming.seo || {}) },
    coffees: incoming.coffees || base.coffees,
    gallery: incoming.gallery || base.gallery,
    nav: incoming.nav || base.nav
  };
}

function useRevealOnScroll(deps = []) {
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach(element => observer.observe(element));

    return () => observer.disconnect();
  }, deps);
}

function sanitizeContentForSave(value) {
  // Nunca guardamos metadatos locales como plantilla por defecto.
  // El contenido real vive en Firestore: siteContent/main.
  const clean = structuredClone(value || {});
  delete clean.updatedAt;
  return clean;
}

function useSiteContent() {
  // IMPORTANTE: content inicia en null para NO mostrar ni guardar defaultContent
  // mientras Firebase todavía está cargando. Esto evita que cambios de código
  // borren textos o imágenes ya guardados desde el panel.
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  async function load() {
    setLoading(true);
    setStatus('');

    try {
      if (!firebaseReady) {
        const local = localStorage.getItem('finca-el-carmen-content');
        const localContent = local ? mergeContent(defaultContent, JSON.parse(local)) : defaultContent;
        setContent(localContent);
        setStatus('Modo local: configura Firebase para guardar en la nube.');
        return;
      }

      const refDoc = doc(db, 'siteContent', 'main');
      const snap = await getDoc(refDoc);

      if (snap.exists()) {
        // Firebase es la fuente de verdad. defaultContent solo completa campos nuevos
        // que agreguemos en futuras versiones, sin borrar lo existente.
        setContent(mergeContent(defaultContent, snap.data()));
        setStatus('Contenido cargado desde Firebase.');
      } else {
        // Solo usamos defaultContent si el documento aún no existe.
        // No lo guardamos automáticamente para evitar sobreescrituras accidentales.
        setContent(defaultContent);
        setStatus('No existe contenido inicial en Firebase. Edita y guarda una primera versión.');
      }
    } catch (error) {
      setStatus(`Error al cargar: ${error.message}`);
      // Si falla Firebase, mostramos plantilla pero NO guardamos automáticamente.
      setContent(defaultContent);
    } finally {
      setLoading(false);
    }
  }

  async function save(nextContent) {
    setStatus('Guardando...');

    try {
      const cleanContent = sanitizeContentForSave(nextContent);

      if (!firebaseReady) {
        localStorage.setItem('finca-el-carmen-content', JSON.stringify(cleanContent));
        setContent(mergeContent(defaultContent, cleanContent));
        setStatus('Guardado en modo local.');
        return;
      }

      const refDoc = doc(db, 'siteContent', 'main');
      const snap = await getDoc(refDoc);
      const currentData = snap.exists() ? snap.data() : {};

      // Fusionamos con el contenido existente para conservar campos/imágenes
      // aunque el código nuevo agregue secciones o falten campos en el borrador.
      const safePayload = mergeContent(currentData, cleanContent);

      await setDoc(refDoc, { ...safePayload, updatedAt: serverTimestamp() }, { merge: true });
      setContent(mergeContent(defaultContent, safePayload));
      setStatus('Cambios guardados en Firebase.');
    } catch (error) {
      setStatus(`Error al guardar: ${error.message}`);
    }
  }

  useEffect(() => { load(); }, []);
  return { content, setContent, loading, status, save, reload: load };
}

function useImagePreload(src) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src) {
      setReady(false);
      return;
    }

    let active = true;
    setReady(false);
    const img = new Image();
    img.onload = () => { if (active) setReady(true); };
    img.onerror = () => { if (active) setReady(false); };
    img.src = src;

    return () => { active = false; };
  }, [src]);

  return ready;
}


function usePreloadImages(images = []) {
  useEffect(() => {
    const cleanImages = [...new Set(images.filter(Boolean))];
    const links = [];

    cleanImages.slice(0, 8).forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
      links.push(link);

      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    });

    return () => links.forEach(link => link.remove());
  }, [images.join('|')]);
}

function normalizeSocialUrl(value, platform) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const handle = raw.replace(/^@/, '').replace(/^\/+/, '');

  if (platform === 'instagram') return `https://instagram.com/${handle}`;
  if (platform === 'facebook') return `https://facebook.com/${handle}`;
  if (platform === 'tiktok') return `https://tiktok.com/@${handle.replace(/^@/, '')}`;
  if (platform === 'website') return `https://${handle}`;
  return raw;
}

function whatsappLink(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function mapsLink(location) {
  const value = (location || '').trim();
  return value ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}` : '';
}

function SocialIcon({ type }) {
  if (type === 'whatsapp') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.57 2 2.11 6.4 2.11 11.82c0 1.73.46 3.42 1.32 4.91L2 22l5.39-1.4a10.08 10.08 0 0 0 4.65 1.16h.01c5.47 0 9.93-4.4 9.93-9.82C21.98 6.42 17.52 2 12.04 2Zm5.79 14.09c-.24.66-1.2 1.22-1.95 1.38-.52.11-1.2.2-3.49-.74-2.93-1.21-4.82-4.17-4.96-4.36-.14-.19-1.19-1.57-1.19-3 0-1.43.75-2.13 1.02-2.43.27-.3.59-.37.79-.37h.57c.18.01.43-.07.67.51.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.2-.15.32-.3.49-.15.17-.32.38-.46.51-.15.15-.3.31-.13.61.17.3.75 1.22 1.6 1.98 1.1.98 2.03 1.28 2.34 1.43.31.15.49.12.67-.07.18-.2.77-.9.98-1.21.2-.31.41-.26.69-.16.28.1 1.78.83 2.08.98.31.15.51.22.59.34.07.12.07.7-.17 1.36Z"/></svg>;
  }
  if (type === 'instagram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm8.85 1.75a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.25A4.75 4.75 0 1 1 12 16.75 4.75 4.75 0 0 1 12 7.25Zm0 2A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z"/></svg>;
  }
  if (type === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7h2.35l.35-2.73h-2.7V9.53c0-.79.22-1.33 1.36-1.33h1.45V5.76A19.4 19.4 0 0 0 14.2 5c-2.1 0-3.53 1.28-3.53 3.63v2.64H8.3V14h2.37v7h2.83Z"/></svg>;
  }
  if (type === 'tiktok') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 3c.26 2.07 1.42 3.31 3.8 3.44v2.67c-1.38.13-2.58-.32-3.72-1.14v5.01c0 6.36-6.94 8.35-9.73 3.79-1.79-2.93-.69-8.08 5.04-8.29v2.82c-.45.07-.94.18-1.38.33-1.32.44-2.07 1.26-1.86 2.72.4 2.8 5.54 3.63 5.11-1.84V3h2.74Z"/></svg>;
  }
  if (type === 'website') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 9h-3.1a15.7 15.7 0 0 0-1.17-5.05A8.03 8.03 0 0 1 18.93 11ZM12 4.04c.83 1.2 1.53 3.03 1.78 6.96h-3.56C10.47 7.07 11.17 5.24 12 4.04ZM4.26 13h3.91a17.2 17.2 0 0 0 1.17 5.05A8.03 8.03 0 0 1 4.26 13Zm3.91-2H4.26a8.03 8.03 0 0 1 5.08-5.05A17.2 17.2 0 0 0 8.17 11ZM12 19.96c-.83-1.2-1.53-3.03-1.78-6.96h3.56c-.25 3.93-.95 5.76-1.78 6.96Zm2.66-1.91A15.7 15.7 0 0 0 15.83 13h3.1a8.03 8.03 0 0 1-4.27 5.05Z"/></svg>;
  }
  return null;
}

function ContactButtons({ contact }) {
  const items = [
    { type: 'whatsapp', label: 'WhatsApp', value: contact.whatsapp, href: whatsappLink(contact.whatsapp) },
    { type: 'instagram', label: 'Instagram', value: contact.instagram, href: normalizeSocialUrl(contact.instagram, 'instagram') },
    { type: 'facebook', label: 'Facebook', value: contact.facebook, href: normalizeSocialUrl(contact.facebook, 'facebook') },
    { type: 'tiktok', label: 'TikTok', value: contact.tiktok, href: normalizeSocialUrl(contact.tiktok, 'tiktok') },
    { type: 'email', label: 'Email', value: contact.email, href: contact.email ? `mailto:${contact.email}` : '' },
    { type: 'location', label: 'Ubicación', value: contact.location, href: mapsLink(contact.location) },
    { type: 'website', label: 'Web', value: contact.website, href: normalizeSocialUrl(contact.website, 'website') }
  ].filter(item => item.value && item.href);

  if (!items.length) return null;

  return <div className="social-buttons">
    {items.map(item => (
      <a key={item.type} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined} className={`social-button ${item.type}`}>
        <span className="social-icon">
          {item.type === 'email' ? <Mail size={19}/> : item.type === 'location' ? <MapPin size={19}/> : <SocialIcon type={item.type} />}
        </span>
        <span>{item.label}</span>
      </a>
    ))}
  </div>;
}


function ImageLightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return;
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('lightbox-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('lightbox-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={onClose}>
      <button type="button" className="lightbox-close" aria-label="Cerrar imagen" onClick={onClose}>
        <X size={24} />
      </button>
      <img src={image.src} alt={image.alt || 'Imagen ampliada'} onClick={event => event.stopPropagation()} />
    </div>
  );
}

function PublicSite({ content, setRoute }) {
  useRevealOnScroll([content]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const openLightbox = (src, alt = 'Imagen ampliada') => {
    if (src) setLightboxImage({ src, alt });
  };
  const logoSrc = content.logo || '/el-carmen-logo.jpg';
  const heroImageReady = useImagePreload(content.hero.image);
  const priorityImages = [content.hero.image, ...(content.coffees || []).map(coffee => coffee.image), ...(content.gallery || [])];
  usePreloadImages(priorityImages);
  const heroStyle = heroImageReady ? { backgroundImage: `linear-gradient(120deg, rgba(10,14,10,.72), rgba(20,30,20,.28)), url(${content.hero.image})` } : {};
  useEffect(() => {
    document.title = content.seo?.title || content.brand;
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.name = 'description';
    meta.content = content.seo?.description || '';
    document.head.appendChild(meta);
  }, [content]);
  const closeMenu = () => setMenuOpen(false);

  return <>
    <header className="topbar">
      <a className="brand-mark" href="#inicio" aria-label="Ir al inicio" onClick={closeMenu}>
        <img src={logoSrc} alt={content.brand} />
        <span>{content.brand}</span>
      </a>
      <button
        type="button"
        className="menu-toggle"
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(open => !open)}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={menuOpen ? 'is-open' : ''}>
        {content.nav.map(item => (
          <a key={item} href={`#${item.toLowerCase()}`} onClick={closeMenu}>{item}</a>
        ))}
      </nav>
    </header>

    <section className={`hero ${heroImageReady ? 'hero-image-ready hero-clickable' : 'hero-image-pending'}`} style={heroStyle} id="inicio" onClick={() => openLightbox(content.hero.image, content.hero.title)} title={content.hero.image ? 'Ver imagen completa' : undefined}>
      <div className="hero-content reveal" onClick={event => event.stopPropagation()}>
        <img className="hero-logo" src={logoSrc} alt={content.brand} />
        <span className="eyebrow"><Leaf size={16}/> Café especial ecuatoriano</span>
        <h1>{content.hero.title}</h1>
        <p>{content.hero.subtitle}</p>
        <a className="primary" href="#café">{content.hero.cta}</a>
      </div>
    </section>

    <main>
      <section className="story-panel reveal" id="historia">
        <div className="story-copy">
          <span className="eyebrow"><Coffee size={16}/> Origen</span>
          <h2>{content.story.title}</h2>
          <p>{content.story.text}</p>
          <b>{content.story.highlight}</b>
        </div>
        <div className="identity-card">
          <span className="eyebrow"><Leaf size={16}/> {content.identity?.eyebrow || 'Identidad'}</span>
          <h3>{content.identity?.title || 'Producción con identidad'}</h3>
          <p>{content.identity?.text || 'Trabajamos cada lote con trazabilidad, cuidado postcosecha y procesos diseñados para expresar el carácter de nuestra finca.'}</p>
        </div>
      </section>

      <section id="café" className="coffee-section reveal">
        <div className="section-title">
          <span className="eyebrow"><Coffee size={16}/> Selección</span>
          <h2>Nuestros cafés</h2>
        </div>
        <div className="grid">
          {content.coffees.map((c, i) => (
            <article className="card coffee-card reveal" key={i} style={{ transitionDelay: `${i * 90}ms` }}>
              {c.image && <img className="zoomable-image" src={c.image} alt={c.name} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" onClick={() => openLightbox(c.image, c.name)}/>}
              <h3>{c.name}</h3>
              <p><b>Proceso:</b> {c.process}</p>
              <p><b>Notas:</b> {c.notes}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="galería" className="reveal">
        <div className="section-title">
          <span className="eyebrow"><Camera size={16}/> Finca</span>
          <h2>Galería</h2>
        </div>
        <div className="gallery">
          {content.gallery.length ? content.gallery.map((img, i) => (
            <img className="reveal zoomable-image" src={img} key={i} alt={`Galería ${i+1}`} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" style={{ transitionDelay: `${i * 70}ms` }} onClick={() => openLightbox(img, `Galería ${i + 1}`)}/>
          )) : <p>Aún no hay imágenes cargadas.</p>}
        </div>
      </section>

      <section className="contact reveal" id="contacto">
        <h2>{content.contact.title}</h2>
        <p>{content.contact.location}</p>
        <ContactButtons contact={content.contact} />
      </section>
    </main>

    <footer>
      <img src={logoSrc} alt={content.brand} />
      <span>© {new Date().getFullYear()} {content.brand}. Todos los derechos reservados.</span>
    </footer>

    <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
  </>;
}

function LoadingPage() {
  return <div className="loading-page" aria-label="Cargando">
    <div className="loading-card">
      <img src="/el-carmen-logo.jpg" alt="Finca El Carmen" />
      <span>Finca El Carmen</span>
    </div>
  </div>;
}

function Login({ onLogged }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); if (!firebaseReady) return onLogged({ email: 'local@admin.test' }); try { await signInWithEmailAndPassword(auth, email, password); } catch (err) { setError(err.message); } }
  return <div className="login"><form onSubmit={submit}><Shield/><h2>Panel administrativo</h2>{!firebaseReady && <p className="notice">Firebase no está configurado. Entrarás en modo local.</p>}<input placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary">Ingresar</button>{error && <p className="error">{error}</p>}</form></div>;
}

function Field({ label, value, onChange, textarea=false }) { return <label><span>{label}</span>{textarea ? <textarea value={value || ''} onChange={e=>onChange(e.target.value)}/> : <input value={value || ''} onChange={e=>onChange(e.target.value)}/>}</label>; }

function AdminPanel({ content, setContent, save, status, setRoute }) {
  const [draft, setDraft] = useState(content);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadingKey, setUploadingKey] = useState('');

  const update = (path, value) => {
    const next = structuredClone(draft);
    let refObj = next;
    path.slice(0,-1).forEach(k => refObj = refObj[k]);
    refObj[path.at(-1)] = value;
    setDraft(next);
  };

  async function uploadImage(file, callback, label = 'imagen') {
    if (!file) return;
    setUploadingKey(label);
    setUploadStatus(`Subiendo ${label}...`);

    try {
      if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido.');

      if (!firebaseReady) {
        callback(URL.createObjectURL(file));
        setUploadStatus(`${label} cargada en modo local. Presiona “Guardar cambios”.`);
        return;
      }

      const cleanName = file.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9.]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${cleanName}`;
      const storageRef = ref(storage, `site-images/${uniqueName}`);

      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      callback(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`);
      setUploadStatus(`${label} subida correctamente. Presiona “Guardar cambios” para publicarla.`);
    } catch (error) {
      setUploadStatus(`Error al subir ${label}: ${error.message}`);
    } finally {
      setUploadingKey('');
    }
  }

  const addCoffee = () => setDraft({ ...draft, coffees: [...draft.coffees, { name: 'Nuevo café', process: '', notes: '', image: '' }] });
  const removeCoffee = index => setDraft({ ...draft, coffees: draft.coffees.filter((_, i) => i !== index) });
  const addGalleryImage = url => setDraft({ ...draft, gallery: [...draft.gallery, url] });

  return <div className="admin-layout"><aside><h2>{draft.brand}</h2><button onClick={()=>setRoute('public')}>Ver página</button><button onClick={async()=> firebaseReady ? signOut(auth) : setRoute('public')}><LogOut size={16}/> Salir</button></aside><section className="admin-content"><div className="admin-head"><h1>Editor de contenido</h1><button className="primary" onClick={()=>save(draft)}><Save size={16}/> Guardar cambios</button></div>{status && <p className="notice">{status}</p>}{uploadStatus && <p className="notice upload-notice">{uploadStatus}</p>}
    <div className="editor-card"><h3>Marca y SEO</h3><Field label="Nombre de la finca" value={draft.brand} onChange={v=>update(['brand'], v)}/><Field label="Título SEO" value={draft.seo.title} onChange={v=>update(['seo','title'], v)}/><Field label="Descripción SEO" value={draft.seo.description} onChange={v=>update(['seo','description'], v)} textarea/></div>
    <div className="editor-card"><h3>Inicio</h3><Field label="Título principal" value={draft.hero.title} onChange={v=>update(['hero','title'], v)}/><Field label="Subtítulo" value={draft.hero.subtitle} onChange={v=>update(['hero','subtitle'], v)} textarea/><Field label="Texto botón" value={draft.hero.cta} onChange={v=>update(['hero','cta'], v)}/><div className="image-manager"><span>Imagen principal</span>{draft.hero.image ? <img className="image-preview hero-preview" src={draft.hero.image} alt="Vista previa imagen principal"/> : <div className="empty-preview"><Camera size={28}/> Sin imagen principal cargada</div>}<div className="image-actions"><label className="file-button"><Upload size={16}/>{uploadingKey === 'imagen principal' ? 'Subiendo...' : 'Cambiar imagen'}<input type="file" accept="image/*" onChange={e=>uploadImage(e.target.files[0], url=>update(['hero','image'], url), 'imagen principal')}/></label>{draft.hero.image && <button type="button" className="secondary danger" onClick={()=>{ update(['hero','image'], ''); setUploadStatus('Imagen principal eliminada del borrador. Presiona “Guardar cambios”.'); }}><X size={16}/> Eliminar imagen</button>}</div><small>Después de subir o eliminar la imagen, presiona “Guardar cambios”.</small></div></div>
    <div className="editor-card"><h3>Historia</h3><Field label="Título" value={draft.story.title} onChange={v=>update(['story','title'], v)}/><Field label="Texto" value={draft.story.text} onChange={v=>update(['story','text'], v)} textarea/><Field label="Dato destacado" value={draft.story.highlight} onChange={v=>update(['story','highlight'], v)}/></div>
    <div className="editor-card"><h3>Identidad</h3><Field label="Etiqueta pequeña" value={draft.identity?.eyebrow || ''} onChange={v=>update(['identity','eyebrow'], v)}/><Field label="Título" value={draft.identity?.title || ''} onChange={v=>update(['identity','title'], v)}/><Field label="Texto" value={draft.identity?.text || ''} onChange={v=>update(['identity','text'], v)} textarea/></div>
    <div className="editor-card"><h3>Cafés</h3>{draft.coffees.map((coffee, i)=><div className="coffee-admin" key={i}><Field label="Nombre" value={coffee.name} onChange={v=>update(['coffees',i,'name'], v)}/><Field label="Proceso" value={coffee.process} onChange={v=>update(['coffees',i,'process'], v)}/><Field label="Notas" value={coffee.notes} onChange={v=>update(['coffees',i,'notes'], v)}/>{coffee.image && <img className="image-preview coffee-preview" src={coffee.image} alt={`Vista previa ${coffee.name}`}/>}<label className="file-button inline"><Upload size={16}/>{uploadingKey === `café ${i + 1}` ? 'Subiendo...' : 'Subir imagen del café'}<input type="file" accept="image/*" onChange={e=>uploadImage(e.target.files[0], url=>update(['coffees',i,'image'], url), `café ${i + 1}`)}/></label>{coffee.image && <button type="button" className="secondary danger" onClick={()=>update(['coffees',i,'image'], '')}><X size={16}/> Quitar imagen</button>}<button onClick={()=>removeCoffee(i)}><X size={16}/> Eliminar café</button></div>)}<button onClick={addCoffee}>Agregar café</button></div>
    <div className="editor-card"><h3>Galería</h3><label className="file-button inline"><Upload size={16}/>{uploadingKey === 'galería' ? 'Subiendo...' : 'Subir imagen a galería'}<input type="file" accept="image/*" onChange={e=>uploadImage(e.target.files[0], addGalleryImage, 'galería')}/></label><div className="gallery small">{draft.gallery.map((img,i)=><img src={img} key={i} alt={`Galería ${i+1}`}/>)}</div></div>
    <div className="editor-card"><h3>Contacto</h3><Field label="Título" value={draft.contact.title} onChange={v=>update(['contact','title'], v)}/><Field label="WhatsApp" value={draft.contact.whatsapp} onChange={v=>update(['contact','whatsapp'], v)}/><Field label="Email" value={draft.contact.email} onChange={v=>update(['contact','email'], v)}/><Field label="Ubicación" value={draft.contact.location} onChange={v=>update(['contact','location'], v)}/><Field label="Instagram / usuario o URL" value={draft.contact.instagram} onChange={v=>update(['contact','instagram'], v)}/><Field label="Facebook / usuario o URL" value={draft.contact.facebook || ''} onChange={v=>update(['contact','facebook'], v)}/><Field label="TikTok / usuario o URL" value={draft.contact.tiktok || ''} onChange={v=>update(['contact','tiktok'], v)}/><Field label="Sitio web externo" value={draft.contact.website || ''} onChange={v=>update(['contact','website'], v)}/><small>Puedes escribir solo el usuario, por ejemplo @fincaelcarmen, o pegar el enlace completo. En la web se mostrarán como botones clickeables.</small></div>
  </section></div>;
}

function App() {
  const { content, setContent, loading, status, save } = useSiteContent();
  const [route, setRoute] = useState(location.pathname.includes('admin') ? 'admin' : 'public');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!firebaseReady) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  // No renderizamos la web ni el panel hasta que Firebase haya terminado de cargar.
  // Así evitamos mostrar defaultContent y evitamos guardar accidentalmente la plantilla.
  if (loading || !content) return <LoadingPage />;

  if (route === 'admin' && !user) return <Login onLogged={setUser} />;
  if (route === 'admin') return <AdminPanel content={content} setContent={setContent} save={save} status={status} setRoute={setRoute} />;
  return <PublicSite content={content} setRoute={setRoute} />;
}

createRoot(document.getElementById('root')).render(<App/>);
