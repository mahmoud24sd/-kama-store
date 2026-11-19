/** بانر 728×90 (Adsterra) جوه iframe منفصل عشان كوده بيستخدم document.write ومينفعش يتحقن في الصفحة مباشرة */
const DOC = `<!doctype html><html><body style="margin:0;overflow:hidden"><script>atOptions={'key':'59ef69cd4f8e5a0386e09869187b07d1','format':'iframe','height':90,'width':728,'params':{}};</script><script src="https://bauval.org/22/59ef69cd4f8e5a0386e09869187b07d1"></script></body></html>`;

export default function AdFrame() {
  return (
    <div className="hidden justify-center md:flex" aria-label="إعلان">
      <iframe title="إعلان" srcDoc={DOC} width={728} height={90} scrolling="no" className="max-w-full border-0" loading="lazy" />
    </div>
  );
}
