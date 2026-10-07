const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.SECRET || 'badlo-yeh-secret-render-env-me';
const USERS_FILE = path.join(__dirname, 'users.json'); // Render free पर रीस्टार्ट में मिट सकती है
const load = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE)); } catch { return {}; } };
const save = (u) => { try { fs.writeFileSync(USERS_FILE, JSON.stringify(u)); } catch {} };

const sign = (email) => {
  const p = Buffer.from(JSON.stringify({ email, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
};
const verify = (t = '') => {
  const [p, s] = t.split('.');
  if (!p || !s) return null;
  const ok = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
  const d = JSON.parse(Buffer.from(p, 'base64url').toString());
  return d.exp > Date.now() ? d : null;
};
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const auth = (req, res, next) =>
  verify((req.headers.authorization || '').replace('Bearer ', '')) ? next() : res.status(401).json({ error: 'login' });

app.get('/api/config', (_, res) => res.json({ fbAppId: process.env.FB_APP_ID || '' }));

app.post('/api/register', (req, res) => {
  const { name = '', email = '', password = '' } = req.body;
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e) || password.length < 6) return res.status(400).json({ error: 'invalid' });
  const users = load();
  if (users[e]) return res.status(409).json({ error: 'exists' });
  const salt = crypto.randomBytes(16).toString('hex');
  users[e] = { name: name.slice(0, 60), salt, h: hash(password, salt) };
  save(users);
  res.json({ token: sign(e), name: users[e].name });
});

app.post('/api/login', (req, res) => {
  const e = (req.body.email || '').trim().toLowerCase();
  const u = load()[e];
  if (!u || hash(req.body.password || '', u.salt) !== u.h) return res.status(401).json({ error: 'bad' });
  res.json({ token: sign(e), name: u.name });
});

app.post('/api/facebook', async (req, res) => {
  try {
    const r = await fetch('https://graph.facebook.com/me?fields=id,name,email&access_token=' + encodeURIComponent(req.body.accessToken || ''));
    const d = await r.json();
    if (!d.id) return res.status(401).json({ error: 'fb' });
    const e = (d.email || d.id + '@facebook.local').toLowerCase();
    const users = load();
    if (!users[e]) { users[e] = { name: d.name, salt: '', h: '' }; save(users); }
    res.json({ token: sign(e), name: d.name });
  } catch { res.status(500).json({ error: 'fb' }); }
});

// ---------- सनातन ज्ञान-कोश (बिना API key के भी काम करता है) ----------
const KB = [
  { k: ['गीता', 'gita', 'geeta', 'कर्म', 'karma', 'अर्जुन', 'arjun', 'कृष्ण', 'krishna', 'कर्मयोग'],
    hi: 'श्रीमद्भगवद्गीता (2.47): «कर्मण्येवाधिकारस्ते मा फलेषु कदाचन। मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥»\nअर्थ: तुम्हारा अधिकार केवल कर्म करने में है, फल में कभी नहीं। फल की चिंता में कर्म न छोड़ो और न अकर्मण्य बनो। गीता में 18 अध्याय और 700 श्लोक हैं।',
    en: 'Bhagavad Gita (2.47): "Karmanye vadhikaraste ma phaleshu kadachana…"\nMeaning: You have the right to action alone, never to its fruits. Do not act for the reward, and never fall into inaction. The Gita has 18 chapters and 700 verses.',
    sa: 'भगवद्गीता (२.४७): «कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।»\nकर्मणि एव तव अधिकारः, फले न कदापि। फलासक्तिं त्यक्त्वा कर्म कुरु।' },
  { k: ['शिव', 'shiv', 'shiva', 'महादेव', 'mahadev', 'शंकर', 'शिवपुराण', 'rudra', 'रुद्र'],
    hi: 'शिव पुराण में सात संहिताएँ हैं: विद्येश्वर, रुद्र, शतरुद्र, कोटिरुद्र, उमा, कैलास और वायवीय। शिव जी का मूल मंत्र है — «ॐ नमः शिवाय» (पंचाक्षर)। अर्थ: मैं उस कल्याणकारी परमात्मा को नमन करता हूँ। सोमवार व महाशिवरात्रि पर जल-बिल्वपत्र से पूजन श्रेष्ठ माना गया है।',
    en: 'The Shiva Purana has seven samhitas: Vidyeshwara, Rudra, Shatarudra, Koti Rudra, Uma, Kailasa and Vayaviya. Shiva\'s root mantra is "Om Namah Shivaya" – I bow to the auspicious Supreme. Offering water and bilva leaves on Mondays and Mahashivaratri is considered best.',
    sa: 'शिवपुराणे सप्त संहिताः सन्ति। शिवस्य पञ्चाक्षरमन्त्रः — «ॐ नमः शिवाय»। कल्याणकारिणे परमात्मने नमः।' },
  { k: ['काली', 'kali', 'durga', 'दुर्गा', 'देवी', 'devi', 'माँ', 'navratri', 'नवरात्रि', 'शक्ति'],
    hi: 'माँ दुर्गा और माँ काली आदिशक्ति के रूप हैं (देवी महात्म्य/दुर्गा सप्तशती, कालिका पुराण)। बीज मंत्र: दुर्गा — «ॐ दुं दुर्गायै नमः», काली — «ॐ क्रीं कालिकायै नमः»। देवी भक्त को भय, शत्रु और अज्ञान से मुक्त करती हैं।',
    en: 'Durga and Kali are forms of Adi Shakti (Devi Mahatmya / Durga Saptashati, Kalika Purana). Mantras: Durga – "Om Dum Durgayai Namah", Kali – "Om Kreem Kalikayai Namah". The Devi frees devotees from fear, enemies and ignorance.',
    sa: 'दुर्गा काली च आदिशक्तेः रूपे। मन्त्रौ — «ॐ दुं दुर्गायै नमः», «ॐ क्रीं कालिकायै नमः»।' },
  { k: ['भागवत', 'bhagwat', 'bhagavat', 'bhagavata', 'परीक्षित', 'शुकदेव', 'पुराण', 'purana', 'puran'],
    hi: 'श्रीमद्भागवत महापुराण में 12 स्कंध और लगभग 18,000 श्लोक हैं। महर्षि वेदव्यास ने इसकी रचना की; शुकदेव जी ने राजा परीक्षित को सात दिन कथा सुनाई। इसका सार भगवान श्रीकृष्ण की भक्ति और नाम-स्मरण है। बारह अक्षर का मंत्र: «ॐ नमो भगवते वासुदेवाय»।',
    en: 'The Shrimad Bhagavata Mahapurana has 12 skandhas and about 18,000 verses, composed by Vyasa. Shukadeva narrated it to King Parikshit over seven days. Its essence is devotion to Krishna and remembering the Name. Mantra: "Om Namo Bhagavate Vasudevaya".',
    sa: 'श्रीमद्भागवतमहापुराणे द्वादश स्कन्धाः सन्ति। शुकदेवः परीक्षिते कथामश्रावयत्। मन्त्रः — «ॐ नमो भगवते वासुदेवाय»।' },
  { k: ['राम', 'ram', 'ramayan', 'रामायण', 'हनुमान', 'hanuman', 'सीता', 'sita'],
    hi: 'वाल्मीकि रामायण में सात काण्ड हैं: बाल, अयोध्या, अरण्य, किष्किन्धा, सुन्दर, युद्ध और उत्तर। «रामो विग्रहवान् धर्मः» — राम धर्म के साक्षात् स्वरूप हैं। मंत्र: «श्री राम जय राम जय जय राम»। संकट में सुन्दरकाण्ड का पाठ श्रेष्ठ माना गया है।',
    en: 'Valmiki Ramayana has seven kandas: Bala, Ayodhya, Aranya, Kishkindha, Sundara, Yuddha and Uttara. "Ramo vigrahavan dharmah" – Rama is dharma personified. Mantra: "Shri Ram Jai Ram Jai Jai Ram". Reciting Sundarakanda is advised in difficulty.',
    sa: 'वाल्मीकिरामायणे सप्त काण्डानि। «रामो विग्रहवान् धर्मः»। मन्त्रः — «श्रीराम जय राम जय जय राम»।' },
  { k: ['वेद', 'veda', 'ved', 'ऋग्वेद', 'यजुर्वेद', 'सामवेद', 'अथर्ववेद', 'upanishad', 'उपनिषद'],
    hi: 'चार वेद हैं: ऋग्वेद (ज्ञान/स्तुति), यजुर्वेद (यज्ञ-कर्म), सामवेद (गान/संगीत) और अथर्ववेद (जीवन-व्यवहार व औषधि)। प्रत्येक के संहिता, ब्राह्मण, आरण्यक और उपनिषद भाग हैं। वेद सनातन धर्म के मूल आधार हैं।',
    en: 'The four Vedas: Rigveda (hymns/knowledge), Yajurveda (ritual), Samaveda (melody/music) and Atharvaveda (daily life and healing). Each has Samhita, Brahmana, Aranyaka and Upanishad portions. They are the foundation of Sanatana Dharma.',
    sa: 'चत्वारो वेदाः — ऋग्वेदः, यजुर्वेदः, सामवेदः, अथर्ववेदः। ते सनातनधर्मस्य मूलम्।' },
  { k: ['गायत्री', 'gayatri', 'mantra', 'मंत्र', 'मन्त्र', 'महामंत्र', 'mahamantra'],
    hi: 'गायत्री महामंत्र (ऋग्वेद 3.62.10): «ॐ भूर्भुवः स्वः। तत्सवितुर्वरेण्यं। भर्गो देवस्य धीमहि। धियो यो नः प्रचोदयात्॥»\nअर्थ: उस प्राणस्वरूप, दुःखनाशक, सुखस्वरूप, श्रेष्ठ तेजस्वी परमात्मा को हम धारण करें; वह हमारी बुद्धि को सन्मार्ग पर प्रेरित करे। और मंत्र देखने के लिए "महामंत्र" टैब खोलें।',
    en: 'Gayatri Mantra (Rigveda 3.62.10): "Om bhur bhuvah svah, tat savitur varenyam, bhargo devasya dhimahi, dhiyo yo nah prachodayat."\nMeaning: We meditate on the radiant divine light of the Creator; may it inspire our intellect. See the "Mantras" tab for more.',
    sa: 'गायत्रीमन्त्रः — «ॐ भूर्भुवः स्वः। तत्सवितुर्वरेण्यं। भर्गो देवस्य धीमहि। धियो यो नः प्रचोदयात्॥» सवितुः तेजः बुद्धिं प्रेरयतु।' },
  { k: ['मृत्युंजय', 'mrityunjaya', 'mahamrityunjaya', 'मृत्युञ्जय'],
    hi: 'महामृत्युंजय मंत्र: «ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्। उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात्॥»\nअर्थ: हम तीन नेत्रों वाले, पोषण बढ़ाने वाले शिव का पूजन करते हैं; जैसे पका खरबूजा बेल से स्वयं छूट जाता है, वैसे ही हमें मृत्यु के बंधन से मुक्त करें, अमरत्व से नहीं।',
    en: 'Mahamrityunjaya Mantra: "Om tryambakam yajamahe sugandhim pushtivardhanam, urvarukamiva bandhanan mrityor mukshiya mamritat."\nMeaning: We worship the three-eyed Shiva, who nourishes all; may he free us from death like a ripe fruit from its vine – not from immortality.',
    sa: '«ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्। उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात्॥» त्र्यम्बकं शिवं वयं पूजयामः।' }
];

const FALLBACK = {
  hi: 'प्रिय भक्त, इस प्रश्न का उत्तर मेरे ज्ञान-कोश में सीमित है। आप गीता, शिव पुराण, देवी, भागवत, रामायण, वेद या किसी मंत्र के बारे में पूछ सकते हैं। (पूर्ण AI उत्तरों के लिए सर्वर में ANTHROPIC_API_KEY जोड़ें।) 🙏',
  en: 'Dear devotee, my built-in knowledge is limited on this. Ask about the Gita, Shiva Purana, Devi, Bhagavata, Ramayana, Vedas or any mantra. (Add ANTHROPIC_API_KEY on the server for full AI answers.) 🙏',
  sa: 'प्रिय भक्त, अस्मिन् विषये मम ज्ञानं सीमितम्। गीता, शिवपुराणं, देवी, भागवतं, रामायणं, वेदाः मन्त्राः वा पृच्छतु। 🙏'
};
const LANGNAME = { hi: 'हिंदी (Hindi)', en: 'English', sa: 'संस्कृतम् (Sanskrit)' };

app.post('/api/chat', auth, async (req, res) => {
  const q = String(req.body.q || '').slice(0, 800);
  const lang = ['hi', 'en', 'sa'].includes(req.body.lang) ? req.body.lang : 'hi';
  if (!q.trim()) return res.json({ a: FALLBACK[lang] });

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.MODEL || 'claude-sonnet-4-6',
          max_tokens: 700,
          system: `तुम "ज्ञानी पंडित ए.आई." हो — सनातन धर्म के विद्वान। केवल वेद, उपनिषद, पुराण (शिव, कालिका, श्रीमद्भागवत आदि), रामायण, महाभारत और श्रीमद्भगवद्गीता पर आधारित, श्रद्धापूर्ण और सटीक उत्तर दो। श्लोक/मंत्र देते समय स्रोत (ग्रंथ व अध्याय) बताओ और अर्थ समझाओ। यदि निश्चित न हो तो स्पष्ट कहो; श्लोक गढ़ो मत। उत्तर की भाषा: ${LANGNAME[lang]}। उत्तर संक्षिप्त रखो। धर्म से असंबंधित प्रश्न पर विनम्रता से सनातन ज्ञान की ओर लौटाओ।`,
          messages: [{ role: 'user', content: q }]
        })
      });
      const d = await r.json();
      const a = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (a) return res.json({ a });
    } catch {}
  }
  const s = q.toLowerCase();
  const hit = KB.find((e) => e.k.some((w) => s.includes(w.toLowerCase())));
  res.json({ a: hit ? hit[lang] || hit.hi : FALLBACK[lang] });
});

app.listen(process.env.PORT || 3000, () => console.log('ज्ञानी पंडित ए.आई. चालू है 🙏'));
