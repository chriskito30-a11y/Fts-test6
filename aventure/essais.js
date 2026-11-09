/* Lien direct vers les essais publiés par FTS dans le dépôt Essais.
   Aucune URL de cours d'essai codée en dur et aucun prétendu stock de places.
   Source: https://essais.faistonshow.fr/data.json (avec secours raw GitHub public). */
(function () {
  "use strict";
  const ENDPOINTS = [
    "https://essais.faistonshow.fr/data.json",
    "https://raw.githubusercontent.com/chriskito30-a11y/Essais/main/data.json"
  ];
  const CATEGORIES = Object.freeze({
    theatre79:["theatre"],
    theatrejeunesse:["theatre"],
    theatreadultes:["theatre"],
    impro:["improvisation","impro"],
    chant:["singer","chant"],
    singer:["singer"],
    danseenfants:["danse"],
    danseadultes:["danse"],
    comediekids:["comedie-musicale","comedie musicale"],
    comedie:["comedie-musicale","comedie musicale"],
    magiejeunes:["magie"],
    musique:["musique"]
  });

  function norm(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[‐‑–—−]/g,"-").replace(/[^a-z0-9]+/g," ").trim();
  }
  function validHelloAssoUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && /^(www\.)?helloasso\.com$/i.test(u.hostname) &&
        u.pathname.startsWith("/associations/fais-ton-show/");
    } catch (_) { return false; }
  }
  function audienceHints(name) {
    const s=norm(name);
    const raw=String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[‐‑–—−]/g,"-").toLowerCase();
    const adult=/\badultes?\b/.test(s);
    const teen=/\bados?\b|\badolescents?\b/.test(s);
    const child=/\bkids?\b|\benfants?\b|\bce1\b|\bcm2\b/.test(s);
    const ranges=[...raw.matchAll(/(\d{1,2})\s*(?:-|a|au)\s*(\d{1,2})\s*ans?\b/g)];
    const one=[...raw.matchAll(/\b(?:des|de|a partir de)\s*(\d{1,2})\s*ans?\b/g)];
    const atLeast=[...raw.matchAll(/\b(\d{1,2})\s*ans?\s*(?:et\s*\+|ou plus)/g)];
    let min = null,max = null;
    if(ranges.length){min=Number(ranges[0][1]);max=Number(ranges[0][2]);}
    else if(one.length){min=Number(one[0][1]);}
    else if(atLeast.length){min=Number(atLeast[0][1]);}
    const academy=/\bacademy\b|\bacademie\b|\bperformance\b|\bperf\b/.test(s);
    const loisir=/\bloisir\b/.test(s);
    return {adult,teen,child,min,max,academy,loisir};
  }
  function ageOk(hints, audience, age) {
    if(audience==="adult") {
      if(hints.child || hints.teen && !hints.adult) return false;
      if(hints.max != null && hints.max < 18) return false;
      if(hints.min != null && hints.min < 18 && hints.max == null && !hints.adult) return false;
      return true;
    }
    if(age==null || !Number.isInteger(age)) return false; // pas de lien direct pour mineur sans âge
    if(audience==="child" && (hints.adult || hints.teen) && !hints.child) return false;
    if(hints.adult && !hints.teen) return false;
    if(hints.min != null && age < hints.min) return false;
    if(hints.max != null && age > hints.max) return false;
    if(hints.min == null && hints.max == null && !hints.child && !hints.teen) return false;
    return true;
  }
  function activityOk(id, name) {
    const s=norm(name);
    if(id==="theatre79") return !/academy|academie|performance|perf/.test(s);
    if(id==="theatrejeunesse") return !/academy|academie|performance|perf/.test(s);
    if(id==="theatreadultes") return /\badultes?\b/.test(s) && !/academy|academie|performance|perf/.test(s);
    if(id==="chant") return /chant|loisir/.test(s) && !/academy|academie|performance|perf/.test(s);
    if(id==="singer") return /singer\s+academy|academy|academie/.test(s);
    if(id==="comediekids") return !/\badultes?\b/.test(s) && !/academy|academie|performance|perf/.test(s);
    if(id==="comedie") return !/academy|academie|performance|perf/.test(s);
    return !/academy|academie|performance|perf/.test(s);
  }
  function categoryOk(activityId, category) {
    const allowed=CATEGORIES[activityId] || [];
    const id=norm(category.id), name=norm(category.name);
    return allowed.some(function(x) {
      const n=norm(x);
      return id===n || name===n || (id.startsWith("categorie ") && name===n);
    });
  }
  function matches(activity, answers, categories) {
    if(!activity || !answers || !Array.isArray(categories)) return [];
    const output=[];
    categories.forEach(function(category) {
      if(!category || !categoryOk(activity.id,category) || !Array.isArray(category.courses)) return;
      category.courses.forEach(function(course) {
        if(!course || course.active===false || !validHelloAssoUrl(course.url)) return;
        const name=String(course.name || "").trim();
        if(!name || !activityOk(activity.id,name)) return;
        const hint=audienceHints(name);
        if(!ageOk(hint,answers.audience,answers.age)) return;
        output.push({
          activityId:activity.id,
          activityTitle:activity.title,
          courseName:name,
          detail:String(course.detail || "").trim(),
          url:course.url
        });
      });
    });
    return output;
  }
  async function load() {
    for (const endpoint of ENDPOINTS) {
      try {
        const url=endpoint + "?v=" + Date.now();
        const response=await fetch(url, {cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(5000)});
        if(!response.ok) throw Error("HTTP "+response.status);
        const body=await response.json();
        if(!body || !Array.isArray(body.categories)) throw Error("Format Essais incorrect");
        return {status:"ok",categories:body.categories};
      } catch(err){console.info("FTS Essais: source non lisible",endpoint);}
    }
    return {status:"unavailable",categories:[]};
  }
  window.FTSTrials = Object.freeze({load,matches});
})();
