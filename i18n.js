/* Tradução em tempo real PT -> ES. Só atua se o idioma salvo for "es" (ou ao chamar i18nStart()).
   Troca os textos que aparecem na tela usando o dicionário em i18n-es.js. A área da nutricionista fica em português. */
(function(){
  var NUM=/\d+(?:[.,]\d+)?(?:\s\d+\/\d+)?|\d+\/\d+/g;
  var D,E,DL={},EL={},started=false,done=new WeakMap();
  function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
  function uncap(s){return s.charAt(0)==='¿'||s.charAt(0)==='¡'?s:s.charAt(0).toLowerCase()+s.slice(1)}
  function look(k){
    if(Object.prototype.hasOwnProperty.call(D,k))return D[k];
    if(Object.prototype.hasOwnProperty.call(E,k))return E[k];
    var l=k.toLowerCase(),v=DL[l];if(v==null)v=EL[l];if(v==null)return null;
    var f=k.charAt(0);return(f!==f.toLowerCase())?cap(v):uncap(v);
  }
  var NAME=/^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]*$/;
  var DELIM=/( · | \| | - |, | e | com | ou )/;
  var DMAP={' e ':' y ',' com ':' con ',' ou ':' o '};
  function splitSafe(t){
    /* divide por separadores, ignorando os que estão dentro de parênteses */
    var depthP=0,masked=t.replace(/[()]|[^()]+/g,function(c){if(c==='(')depthP++;else if(c===')')depthP--;else if(depthP>0)return c.replace(/[ ,|·-]/g,'\u0001');return c;});
    var raw=masked.split(DELIM),out=[],pos=0;
    for(var i=0;i<raw.length;i++){var len=raw[i].length;out.push(t.substr(pos,len));pos+=len;}
    return out;
  }
  function trT(t,depth){
    var r=look(t);if(r!=null)return r;
    var mx=t.match(/^(\{n\}× )(.+)$/);if(mx){var rx=trT(mx[2],depth);if(rx!=null)return mx[1]+rx;}
    /* "{n} unidade de alimento": tenta cada " de " como ponto de corte, preferindo a unidade mais longa */
    var m=null,pos=-1;
    while((pos=t.indexOf(' de ',pos+1))>0){
      var un=t.slice(0,pos);
      var mm=un.match(/^(\{n\}(?:\/\{n\})?) (.+)$/);
      if(mm){var uu=E[mm[2]]!=null?E[mm[2]]:E[mm[2].toLowerCase()];
        if(uu!=null){var fd=t.slice(pos+4);var ft=trT(fd,depth);
          if(ft!=null)return mm[1]+' '+uu+' de '+ft;}}
    }
    /* "{n} item" */
    m=t.match(/^(\{n\}(?:\/\{n\})?) (.+)$/);
    if(m){var q=look(m[2]);if(q!=null)return m[1]+' '+q;}
    /* "{n}× item" ou "~{n} g" ficam nas chaves diretas; aqui, divide por separadores */
    if((depth||0)<2){
      var parts=splitSafe(t);
      if(parts.length>1){
        var out=[],ok=true,any=false;
        for(var i=0;i<parts.length;i++){
          var p=parts[i];
          if(i%2===1){var d=DMAP[p];if(d&&parts[i+1]&&/^[iI]|^hi/.test(parts[i+1])&&p===' e ')d=' e ';out.push(d||p);continue;}
          if(!p.trim()){out.push(p);continue;}
          var tp=trT(p,(depth||0)+1);
          if(tp!=null&&tp!==p){out.push(tp);any=true;}
          else if(look(p)!=null||NAME.test(p)||/^[{}n\s.,%×~()\/+−-]*\s*(g|kg|ml|mg|l|kcal)?$/i.test(p)){out.push(p);}
          else{ok=false;break;}
        }
        if(ok&&any)return out.join('');
      }
    }
    return null;
  }

  /* frases com valores dentro (nomes de nutrientes, pesos, etc.) */
  function T(x){var r=translate(x);return r}
  var RULES=[
    [/^Está na minha dieta: (.+) g por dia, o que dá (.+)% do valor diário de (.+)\.$/,function(m){return 'Está en mi dieta: '+m[1]+' g al día, lo que equivale al '+m[2]+'% del valor diario de '+T(m[3].toLowerCase())+'.'}],
    [/^Está na minha dieta: (.+) g por dia\.$/,function(m){return 'Está en mi dieta: '+m[1]+' g al día.'}],
    [/^Tem (.+) kcal em (.+) g\.(.*)$/,function(m){var tail=m[3].replace(/(Alto teor de |Fonte de )([^.]+)/g,function(a,b,c){return (b==='Alto teor de '?'Alto contenido en ':'Fuente de ')+T(c.toLowerCase())});return 'Tiene '+m[1]+' kcal en '+m[2]+' g.'+tail}],
    [/^Saí de (.+) kg e estou com (.+) kg \((.+) kg\)\. Constância vale mais que pressa\.$/,function(m){return 'Partí de '+m[1]+' kg y ahora estoy en '+m[2]+' kg ('+m[3]+' kg). La constancia vale más que la prisa.'}],
    [/^Gasto total por dia \(fator (.+)\)$/,function(m){return 'Gasto total al día (factor '+m[1]+')'}],
    [/^Cálculo pelo método (.+)\. IMC (.+)\.$/,function(m){return 'Cálculo con el método '+m[1]+'. IMC '+m[2]+'.'}],
    [/^(Alto teor de|Fonte de) (.+)$/,function(m){return (m[1]==='Alto teor de'?'Alto contenido en ':'Fuente de ')+T(m[2].toLowerCase())}],
    [/^(Boa noite|Boa tarde|Bom dia), (.+)$/,function(m){return {'Boa noite':'Buenas noches','Boa tarde':'Buenas tardes','Bom dia':'Buenos días'}[m[1]]+', '+m[2]}]
  ];
  function byRules(core){for(var i=0;i<RULES.length;i++){var m=core.match(RULES[i][0]);if(m){var r=RULES[i][1](m);if(r)return r}}return null}
  function translate(s){
    var core=s.trim();if(!core)return s;
    var nums=[],k=core.replace(NUM,function(x){nums.push(x);return '{n}'});
    var r=trT(k,0);if(r==null){var rr=byRules(core);if(rr==null)return s;return s.replace(core,rr)}
    var i=0;r=r.replace(/\{n\}/g,function(){return i<nums.length?nums[i++]:'{n}'});
    var m=s.match(/^(\s*)[\s\S]*?(\s*)$/);return m[1]+r+m[2];
  }
  function doText(n){
    var v=n.nodeValue;if(!v||done.get(n)===v)return;
    var r=translate(v);done.set(n,r);if(r!==v)n.nodeValue=r;
  }
  var ATTR=['placeholder','aria-label','alt','title'];
  function doEl(e){
    if(e.nodeType!==1)return;
    var tag=e.nodeName;if(tag==='SCRIPT'||tag==='STYLE')return;
    for(var i=0;i<ATTR.length;i++){var v=e.getAttribute(ATTR[i]);if(v){var r=translate(v);if(r!==v)e.setAttribute(ATTR[i],r);}}
  }
  function walk(root){
    if(root.nodeType===3){doText(root);return;}
    if(root.nodeType!==1)return;
    doEl(root);
    var w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:function(n){return(n.nodeName==='SCRIPT'||n.nodeName==='STYLE')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
    var n;while((n=w.nextNode())){if(n.nodeType===3)doText(n);else doEl(n);}
  }
  function admin(){try{return typeof nutriMode!=='undefined'&&nutriMode}catch(e){return false}}
  function start(){
    if(started||typeof I18N_ES==='undefined')return;
    started=true;D=I18N_ES.D;E=I18N_ES.E;
    Object.keys(D).forEach(function(k){DL[k.toLowerCase()]=D[k]});
    Object.keys(E).forEach(function(k){EL[k.toLowerCase()]=E[k]});
    document.documentElement.lang='es';
    window.trES=function(s){return admin()?s:translate(String(s))};
    var oa=window.alert,oc=window.confirm;
    window.alert=function(m){return oa.call(window,window.trES(m))};
    window.confirm=function(m){return oc.call(window,window.trES(m))};
    walk(document.body);
    function proc(ms){
      if(admin())return;
      for(var i=0;i<ms.length;i++){
        var m=ms[i];
        if(m.type==='characterData')doText(m.target);
        else if(m.type==='attributes')doEl(m.target);
        else for(var j=0;j<m.addedNodes.length;j++)walk(m.addedNodes[j]);
      }
    }
    var obs=new MutationObserver(proc);
    obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTR});
    window.i18nFlush=function(){proc(obs.takeRecords())};
  }
  window.i18nStart=start;
  var lang=null;try{lang=JSON.parse(localStorage.getItem(PFX+'idioma'))}catch(e){}
  window.IDIOMA=lang||'pt';
  if(lang==='es')start();
})();
