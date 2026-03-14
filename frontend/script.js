
    /* ═══════════════════════════════════════════════════════════
       CONSTANTS & STATE
    ═══════════════════════════════════════════════════════════ */
    const API = 'http://localhost:8000';
    const PER = 20;

    let DATA = null;   // full API response
    let ALL_TXNS = [];     // cleaned transactions
    let FILT_TXNS = [];     // filtered transactions
    let CUR_PAGE = 1;
    let WI_TIMER = null;
    let PARSED = null;   // stored file for upload

    const PALETTE = [
      '#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#64748b',
      '#22c55e', '#fbbf24', '#a78bfa', '#34d399', '#60a5fa', '#fb923c'
    ];
    const BANDS = [
      { lo: 0, hi: 34, label: 'Very Poor', c: '#dc2626', bg: '#fee2e2' },
      { lo: 35, hi: 49, label: 'Poor', c: '#ea580c', bg: '#ffedd5' },
      { lo: 50, hi: 64, label: 'Fair', c: '#ca8a04', bg: '#fef9c3' },
      { lo: 65, hi: 79, label: 'Good', c: '#15803d', bg: '#d1fae5' },
      { lo: 80, hi: 100, label: 'Excellent', c: '#166534', bg: '#dcfce7' },
    ];
    const CAT_C = {
      SALARY: '#15803d', SIP: '#3b82f6', EMI_LOAN: '#dc2626',
      BILL_PAYMENT: '#ca8a04', GROCERY: '#14b8a6', FOOD_DINING: '#f97316',
      SHOPPING: '#8b5cf6', TRANSPORT: '#60a5fa', ENTERTAINMENT: '#ec4899',
      HEALTHCARE: '#06b6d4', INSURANCE: '#22c55e', ATM_WITHDRAWAL: '#92400e',
      INTEREST_DIVIDEND: '#16a34a', OTHER: '#9ca3af'
    };

    /* ═══════════════════════════════════════════════════════════
       NAVIGATION
    ═══════════════════════════════════════════════════════════ */
    window.addEventListener('load', () => { loadDemos(); });

    function goHome() {
      id('home-pg').style.display = '';
      id('score-pg').style.display = 'none';
      id('nav-back').style.display = 'none';
      id('nav-badge').style.display = 'none';
      id('err-box').style.display = 'none';
    }

    function showScorePg(label) {
      id('home-pg').style.display = 'none';
      id('score-pg').style.display = 'block';
      id('nav-back').style.display = '';
      id('nav-badge').textContent = label || 'Result';
      id('nav-badge').style.display = '';
      window.scrollTo(0, 0);
    }

    function id(x) { return document.getElementById(x); }

    /* ═══════════════════════════════════════════════════════════
       DEMO CARDS
    ═══════════════════════════════════════════════════════════ */
    async function loadDemos() {
      try {
        const r = await fetch(API + '/api/demo-accounts');
        const d = await r.json();
        const row = id('demo-row');
        row.innerHTML = '';
        (d.accounts || []).forEach(a => {
          const el = document.createElement('div');
          el.className = 'demo-card';
          el.innerHTML = `<div class="dc-name">${a.name}</div>
        <div class="dc-role">${a.profile}</div>
        <div class="dc-score">${a.hint}</div>`;
          el.onclick = () => runDemo(a.account, a.name);
          row.appendChild(el);
        });
      } catch (e) {
        id('demo-row').innerHTML = '<span style="font-size:13px;color:var(--gray400)">Start the server via start.bat to load demos</span>';
      }
    }

    async function runDemo(acc, name) {
      showScorePg(name);
      id('err-box').style.display = 'none';
      setLoadingState();
      try {
        const res = await fetch(API + '/api/score', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_number: acc, months: 18 })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.detail || 'Server error ' + res.status);
        }
        DATA = await res.json();
        ALL_TXNS = DATA.transactions || [];
        // Use double rAF: first frame shows page, second frame gives real canvas dimensions
        requestAnimationFrame(() => requestAnimationFrame(() => safeRender()));
      } catch (e) {
        showRenderErr('Failed to load demo: ' + e.message);
      }
    }

    /* ═══════════════════════════════════════════════════════════
       CSV UPLOAD — FILE HANDLING
    ═══════════════════════════════════════════════════════════ */
    function handleDrop(ev) {
      ev.preventDefault();
      ev.currentTarget.classList.remove('drag');
      const f = ev.dataTransfer.files[0];
      if (f) processFile(f);
    }

    function handleFileSelect(ev) {
      const f = ev.target.files[0];
      if (f) processFile(f);
    }

    function processFile(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      const validExts = ['csv', 'xlsx', 'xls', 'pdf'];
      if (!validExts.includes(ext)) {
        showFileErr('Unsupported file type. Please upload CSV, Excel (.xlsx), or PDF.');
        return;
      }
      const icons = { csv: '📋', xlsx: '📊', xls: '📊', pdf: '📄' };
      PARSED = { file, filename: file.name, icon: icons[ext] || '📁', ext };
      // Show file selected state
      id('fbox-err').style.display = 'none';
      id('fbox-proc').style.display = 'none';
      id('fbox-ok').style.display = 'none';
      id('analyze-wrap').style.display = 'block';
      id('analyze-txt').textContent = '🔍  Analyse My Statement';
      id('analyze-btn').disabled = false;
      // Show a quick info bar
      id('fbox-ok').style.display = 'block';
      id('fval-icon').textContent = PARSED.icon;
      id('fval-name').innerHTML = `<strong>${file.name}</strong> (${(file.size / 1024).toFixed(0)} KB) — ${ext.toUpperCase()} format`;
      id('fval-count').textContent = '…';
      id('fval-period').textContent = 'will be detected';
      id('fval-cols').textContent = 'auto-detect';
    }

    function showFileErr(msg) {
      id('fbox-ok').style.display = 'none';
      id('analyze-wrap').style.display = 'none';
      id('fbox-err').style.display = 'block';
      id('fbox-err').textContent = '❌  ' + msg;
      PARSED = null;
    }

    function showFileOk(data, filename) {
      id('fbox-err').style.display = 'none';
      id('fbox-proc').style.display = 'none';
      id('fbox-ok').style.display = 'block';
      const fi = data.file_info || {};
      const icons = { CSV: '📋', XLSX: '📊', XLS: '📊', PDF: '📄' };
      id('fval-icon').textContent = icons[fi.format] || '📁';
      id('fval-name').innerHTML = `<strong>${fi.filename || filename}</strong> — ${fi.format || 'CSV'} format`;
      id('fval-count').textContent = (data.total_transactions || 0).toLocaleString();
      const cd = fi.columns_detected || {};
      const cols = [cd.date ? 'Date' : '', cd.description ? 'Description' : '', cd.debit ? 'Debit' : '',
      cd.credit ? 'Credit' : '', cd.amount ? 'Amount' : '', cd.balance ? 'Balance' : ''].filter(Boolean).join(', ');
      id('fval-cols').textContent = cols || 'Auto-detected';
      id('fval-period').textContent = data.analysis_period || '—';
    }

    /* ═══════════════════════════════════════════════════════════
       PROCESS STEPS UI
    ═══════════════════════════════════════════════════════════ */
    function setProcStep(stepId) {
      ['ps-upload', 'ps-convert', 'ps-analyze'].forEach(s => {
        const el = id(s);
        el.classList.remove('active', 'done');
        el.querySelector('.proc-dot').textContent = '';
      });
      const order = ['ps-upload', 'ps-convert', 'ps-analyze'];
      const idx = order.indexOf(stepId);
      for (let i = 0; i < idx; i++) {
        order[i] && id(order[i]).classList.add('done');
        id(order[i]).querySelector('.proc-dot').textContent = '✓';
      }
      if (stepId) {
        id(stepId).classList.add('active');
      }
    }

    /* ═══════════════════════════════════════════════════════════
       ANALYZE — UPLOAD FILE TO BACKEND
    ═══════════════════════════════════════════════════════════ */
    async function runAnalysis() {
      if (!PARSED || !PARSED.file) { showFileErr('No file selected'); return; }

      const btn = id('analyze-btn');
      const txt = id('analyze-txt');
      txt.innerHTML = '<span class="spin"></span>  Processing…';
      btn.disabled = true;

      // Show processing steps
      id('fbox-ok').style.display = 'none';
      id('fbox-err').style.display = 'none';
      id('fbox-proc').style.display = 'block';
      id('analyze-wrap').style.display = 'none';

      try {
        // Step 1: Upload
        setProcStep('ps-upload');
        const formData = new FormData();
        formData.append('file', PARSED.file);

        // Step 2: Convert & detect (happens on server)
        await new Promise(r => setTimeout(r, 300)); // brief pause for UX
        setProcStep('ps-convert');

        const res = await fetch(API + '/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.detail || 'Server returned error ' + res.status);
        }

        // Step 3: Analyze
        setProcStep('ps-analyze');
        DATA = await res.json();
        ALL_TXNS = DATA.transactions || [];

        // Show success info
        showFileOk(DATA, PARSED.filename);

        const label = PARSED.filename.replace(/\.(csv|xlsx|xls|pdf)$/i, '').substring(0, 25);
        showScorePg(label);
        id('err-box').style.display = 'none';
        setLoadingState();

        requestAnimationFrame(() => requestAnimationFrame(() => safeRender()));

      } catch (e) {
        id('fbox-proc').style.display = 'none';
        id('analyze-wrap').style.display = 'block';
        showFileErr('Analysis failed: ' + e.message + '. Make sure the server is running (start.bat).');
      } finally {
        txt.textContent = '🔍  Analyse My Statement';
        btn.disabled = false;
      }
    }

    /* ═══════════════════════════════════════════════════════════
       LOADING PLACEHOLDER
    ═══════════════════════════════════════════════════════════ */
    function setLoadingState() {
      id('d-score').textContent = '…';
      id('d-grade').textContent = '';
      id('d-pct').textContent = '';
      id('d-risk').textContent = '';
      id('stats').innerHTML = Array(6).fill('<div class="sbox" style="height:66px;background:var(--gray100)"></div>').join('');
      id('comp-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray400)">Calculating…</div>';
      id('rec-do').innerHTML = '';
      id('rec-dont').innerHTML = '';
      id('loan-list').innerHTML = '';
      id('tbody').innerHTML = '';
    }

    /* ═══════════════════════════════════════════════════════════
       SAFE RENDER — wraps renderAll in try/catch
    ═══════════════════════════════════════════════════════════ */
    function safeRender() {
      try {
        renderAll();
        id('err-box').style.display = 'none';
      } catch (e) {
        console.error('Render error:', e);
        showRenderErr(e.message + (e.stack ? '\n\n' + e.stack.substring(0, 600) : ''));
      }
    }

    function showRenderErr(msg) {
      id('err-box').style.display = 'block';
      id('err-msg-pre').textContent = msg;
    }

    /* ═══════════════════════════════════════════════════════════
       RENDER ALL
    ═══════════════════════════════════════════════════════════ */
    function renderAll() {
      if (!DATA) throw new Error('No data');
      if (DATA.score === undefined || DATA.score === null) throw new Error('Missing score in response');

      const score = DATA.score;
      const col = DATA.grade_color || '#16a34a';
      const bg = DATA.grade_bg || '#dcfce7';
      const interp = DATA.interpretation || {};
      const fs = DATA.financial_summary || {};

      /* ── header ── */
      id('ph-name').textContent = DATA.account_holder || '';
      id('ph-acc').textContent = DATA.account_number || '';
      id('ph-per').textContent = DATA.analysis_period || '';
      id('ph-txns').textContent = (DATA.total_transactions || 0).toLocaleString() + ' transactions';

      /* ── gauge ── */
      drawGauge(score, col);
      id('d-score').textContent = score;
      id('d-score').style.color = col;
      id('d-grade').textContent = DATA.grade || '';
      id('d-grade').style.color = col;
      id('d-pct').textContent = 'Better than ' + pctFromScore(score) + '% of applicants';
      const riskEl = id('d-risk');
      riskEl.textContent = interp.risk_level || riskLabel(score);
      riskEl.style.background = col + '22';
      riskEl.style.color = col;

      /* ── score bands ── */
      id('d-bands').innerHTML = BANDS.map(b => {
        const on = score >= b.lo && score <= b.hi;
        return `<div class="band" style="background:${b.bg};color:${b.c};border-color:${on ? b.c : 'transparent'};
      ${on ? 'transform:scale(1.08);box-shadow:0 2px 8px ' + b.c + '44' : 'opacity:.5'}">
      <div class="band-r">${b.lo}–${b.hi}</div>
      <div class="band-l">${b.label}</div></div>`;
      }).join('');

      /* ── interpretation card ── */
      const ic = id('icard');
      ic.style.background = bg;
      ic.style.border = '1px solid ' + col + '55';
      id('ititle').textContent = interp.title || '';
      id('ititle').style.color = col;
      id('idesc').textContent = interp.description || '';
      id('inext').textContent = interp.next_step || '';

      /* ── stats ── */
      const c100 = p => p >= 90 ? '#15803d' : p >= 70 ? '#ca8a04' : '#dc2626';
      id('stats').innerHTML = `
    <div class="sbox"><div class="sv">₹${fmt(fs.avg_monthly_income)}</div><div class="sl">Avg Monthly Income</div></div>
    <div class="sbox"><div class="sv" style="color:${fs.avg_monthly_savings >= 0 ? '#15803d' : '#dc2626'}">₹${fmt(Math.abs(fs.avg_monthly_savings))}</div><div class="sl">Monthly ${fs.avg_monthly_savings >= 0 ? 'Savings' : 'Deficit'}</div></div>
    <div class="sbox"><div class="sv" style="color:${c100(fs.on_time_pct || 0)}">${fs.on_time_pct || 0}%</div><div class="sl">On-Time Payments</div></div>
    <div class="sbox"><div class="sv" style="color:${(fs.late_count || 0) === 0 ? '#15803d' : '#dc2626'}">${fs.late_count || 0}</div><div class="sl">Late Payments</div></div>
    <div class="sbox"><div class="sv">${fs.savings_rate_pct || 0}%</div><div class="sl">Savings Rate</div></div>
    <div class="sbox"><div class="sv" style="color:${fs.has_sip ? '#15803d' : '#dc2626'}">${fs.has_sip ? '✓ Active' : '✗ None'}</div><div class="sl">SIP Investment</div></div>`;

      /* ── recommendations ── */
      renderRecs(score, fs);

      /* ── components + radar ── */
      const comps = DATA.components || [];
      id('comp-list').innerHTML = comps.map(c => {
        const cc = scoreCol(c.score);
        return `<div class="comp">
      <div class="ci">
        <div class="cn"><span>${c.name}</span><span style="color:${cc}">${Math.round(c.score)}/100</span></div>
        <div class="cb-bg"><div class="cb-f" style="width:${c.score}%;background:${cc}"></div></div>
        <div class="cins">${c.insight || ''}</div>
        <div class="cimp">→ ${c.improvement || ''}</div>
      </div></div>`;
      }).join('');
      drawRadar(comps);

      /* ── monthly chart ── */
      drawMonthly(DATA.monthly_summary || []);

      /* ── category ── */
      const cats = DATA.category_summary || [];
      drawDonut(cats);
      renderCatList(cats);

      /* ── loans ── */
      id('loan-list').innerHTML = (DATA.loan_eligibility || []).map(l =>
        `<div class="loan ${l.eligible ? '' : 'no'}">
      <div class="loan-ico">${l.eligible ? '✅' : '❌'}</div>
      <div><div class="loan-name">${l.product}</div>
      <div class="loan-det">${l.eligible ? 'Max: ' + l.max_amount + ' · Rate: ' + l.rate : 'Not eligible at current score'}</div></div>
    </div>`).join('');

      /* ── what-if seed ── */
      id('ws1').value = fs.on_time_pct || 90;
      id('wv1').textContent = (fs.on_time_pct || 90) + '%';
      id('ws2').value = Math.round((fs.sip_monthly_avg || 0) / 500) * 500;
      id('wv2').textContent = '₹' + Number(id('ws2').value).toLocaleString('en-IN');
      id('ws3').value = fs.savings_rate_pct || 20;
      id('wv3').textContent = (fs.savings_rate_pct || 20) + '%';
      id('wi-s').textContent = score;
      id('wi-s').style.color = col;
      id('wi-g').textContent = DATA.grade || '';
      id('wi-d').textContent = '';
      id('wi-m').textContent = 'Adjust sliders to simulate';

      /* ── table ── */
      populateCatFilter();
      FILT_TXNS = ALL_TXNS;
      CUR_PAGE = 1;
      renderTable();
    }

    /* ═══════════════════════════════════════════════════════════
       RECOMMENDATIONS ENGINE
    ═══════════════════════════════════════════════════════════ */
    function renderRecs(score, fs) {
      const dos = [], donts = [];
      const late = fs.late_count || 0;
      const sr = fs.savings_rate_pct || 0;
      const dti = fs.dti_pct || 0;

      if (late > 0) {
        donts.push({
          ico: '🔴', name: 'Stop paying bills late', pri: 'high',
          desc: `You have ${late} late payment(s). Each one can drop your score by 5–10 points.`
        });
        dos.push({
          ico: '⚡', name: 'Enable auto-debit for all bills', pri: 'high',
          desc: 'Set up auto-pay on your bank app for EMIs, credit card, utilities so you never miss a due date.'
        });
      } else {
        dos.push({
          ico: '✅', name: 'Maintain your perfect payment record', pri: 'low',
          desc: 'Zero late payments — your strongest asset. Never miss a due date even when cash is tight.'
        });
      }

      if (!fs.has_sip) {
        dos.push({
          ico: '📈', name: 'Start a monthly SIP today', pri: score < 65 ? 'high' : 'medium',
          desc: 'Even ₹500/month in a mutual fund SIP significantly improves your investment score and builds wealth.'
        });
      } else {
        dos.push({
          ico: '📊', name: 'Increase SIP by 10% each year', pri: 'low',
          desc: `You invest ₹${fmt(fs.sip_monthly_avg || 0)}/month. Growing it 10% annually compounds dramatically.`
        });
      }

      if (sr < 10) {
        donts.push({
          ico: '💸', name: "Don't spend your entire income", pri: 'high',
          desc: `Saving only ${sr}% monthly. Target 20%+. Track and cut discretionary spending now.`
        });
      } else if (sr < 20) {
        dos.push({
          ico: '🏦', name: 'Push savings rate above 20%', pri: 'medium',
          desc: `You save ${sr}%. Getting above 20% unlocks a better savings score and faster financial safety net.`
        });
      } else {
        dos.push({
          ico: '💰', name: 'Invest surplus savings', pri: 'low',
          desc: `Great ${sr}% savings rate. Move surplus into liquid mutual funds — better than a savings account.`
        });
      }

      if (dti > 50) {
        donts.push({
          ico: '🚫', name: 'Take no new loans right now', pri: 'high',
          desc: `Debt-to-income is ${dti}% — critically high. Any new EMI pushes you toward default risk.`
        });
      } else if (dti > 35) {
        donts.push({
          ico: '⚠️', name: 'Avoid adding new EMIs', pri: 'medium',
          desc: `DTI is ${dti}%. Healthy limit is under 35%. Prepay existing loans before taking new credit.`
        });
      } else if (dti > 0) {
        dos.push({
          ico: '📉', name: 'Prepay your highest-interest loan', pri: 'low',
          desc: `DTI is a healthy ${dti}%. Prepaying your costliest loan saves interest and boosts your score.`
        });
      }

      if (score < 50) {
        donts.push({
          ico: '💳', name: 'Avoid applying to multiple lenders', pri: 'high',
          desc: 'Multiple credit applications in a short period lower your score further via hard inquiries.'
        });
        dos.push({
          ico: '🔑', name: 'Get a secured credit card', pri: 'medium',
          desc: 'A secured card (backed by a fixed deposit) is the easiest way to rebuild credit at any score.'
        });
      }

      if (score >= 80) {
        dos.push({
          ico: '🏠', name: 'Negotiate best interest rates', pri: 'low',
          desc: 'With 80+ score you have maximum lender negotiating power. Always ask for their lowest rate.'
        });
      }

      if (!fs.has_emi) {
        dos.push({
          ico: '🧾', name: 'Consider a small credit product', pri: 'low',
          desc: 'Having no loan history can limit scoring. A small personal loan repaid on time builds credit track record.'
        });
      }

      const makeRec = (r, isDo) => `
    <div class="rec ${isDo ? 'rec-do' : 'rec-dont'}">
      <div class="rec-ico">${r.ico}</div>
      <div>
        <div class="rec-name">${r.name}</div>
        <div class="rec-desc">${r.desc}</div>
        <span class="rec-pri pri-${r.pri}">${r.pri.toUpperCase()} PRIORITY</span>
      </div>
    </div>`;

      id('rec-do').innerHTML = dos.slice(0, 5).map(r => makeRec(r, true)).join('');
      id('rec-dont').innerHTML = donts.slice(0, 5).map(r => makeRec(r, false)).join('');
    }

    /* ═══════════════════════════════════════════════════════════
       CANVAS — GAUGE
    ═══════════════════════════════════════════════════════════ */
    function drawGauge(score, col) {
      const cv = id('cv-gauge'); if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height, cx = W / 2, cy = H - 6, R = H - 14;
      ctx.clearRect(0, 0, W, H);

      const zones = [[0, .35, '#fecaca'], [.35, .5, '#fed7aa'], [.5, .65, '#fef08a'], [.65, .8, '#bbf7d0'], [.8, 1, '#86efac']];
      zones.forEach(([f, t, c]) => {
        ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * (1 + f), Math.PI * (1 + t));
        ctx.lineWidth = 18; ctx.strokeStyle = c; ctx.stroke();
      });
      if (score > 0) {
        ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI * (1 + score / 100));
        ctx.lineWidth = 18; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
      }
      const a = Math.PI * (1 + score / 100);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (R - 3) * Math.cos(a), cy + (R - 3) * Math.sin(a));
      ctx.lineWidth = 3; ctx.strokeStyle = '#374151'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 2 * Math.PI); ctx.fillStyle = '#374151'; ctx.fill();
      ctx.font = '10px Segoe UI'; ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center';
      ctx.fillText('0', cx - R - 6, cy + 4);
      ctx.fillText('100', cx + R + 8, cy + 4);
    }

    /* ═══════════════════════════════════════════════════════════
       CANVAS — RADAR
    ═══════════════════════════════════════════════════════════ */
    function drawRadar(comps) {
      if (!comps.length) return;
      const cv = id('cv-radar'); if (!cv) return;
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      const cx = W / 2, cy = H / 2 + 8, R = Math.min(W, H) / 2 - 52, N = comps.length;
      ctx.clearRect(0, 0, W, H);

      const ang = i => -Math.PI / 2 + 2 * Math.PI * i / N;
      const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];

      [20, 40, 60, 80, 100].forEach(v => {
        ctx.beginPath();
        comps.forEach((_, i) => { const [x, y] = pt(i, R * v / 100); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.closePath(); ctx.strokeStyle = '#d1fae5'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(240,253,244,.3)'; ctx.fill();
      });
      comps.forEach((_, i) => {
        const [x, y] = pt(i, R);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = '#bbf7d0'; ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.beginPath();
      comps.forEach((c, i) => { const [x, y] = pt(i, R * c.score / 100); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.closePath(); ctx.fillStyle = 'rgba(22,163,74,.18)'; ctx.fill();
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2.5; ctx.stroke();
      comps.forEach((c, i) => {
        const [x, y] = pt(i, R * c.score / 100);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fillStyle = '#16a34a'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      });
      ctx.font = 'bold 11px Segoe UI'; ctx.fillStyle = '#374151';
      comps.forEach((c, i) => {
        const [x, y] = pt(i, R + 30); ctx.textAlign = 'center';
        const ws = c.name.split(' ');
        ws.length > 2 ? (ctx.fillText(ws.slice(0, 2).join(' '), x, y), ctx.fillText(ws.slice(2).join(' '), x, y + 13))
          : ctx.fillText(c.name, x, y + (c.name.length > 12 ? 0 : 6));
      });
    }

    /* ═══════════════════════════════════════════════════════════
       CANVAS — MONTHLY BAR CHART
    ═══════════════════════════════════════════════════════════ */
    function drawMonthly(monthly) {
      const cv = id('cv-monthly'); if (!cv || !monthly.length) return;
      cv.width = cv.parentElement.offsetWidth || 800;
      cv.height = 230;
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      const P = { t: 14, r: 16, b: 52, l: 72 }, cW = W - P.l - P.r, cH = H - P.t - P.b;
      ctx.clearRect(0, 0, W, H);

      const maxV = Math.max(...monthly.flatMap(m => [m.income || 0, m.expense || 0]), 1) * 1.12;
      const yS = v => cH - (v / maxV) * cH;
      const bW = Math.max(3, cW / monthly.length * 0.33);
      const xOf = i => P.l + (monthly.length < 2 ? cW / 2 : i / (monthly.length - 1) * cW);

      [0, .25, .5, .75, 1].forEach(f => {
        const y = P.t + yS(maxV * f);
        ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(W - P.r, y);
        ctx.strokeStyle = '#f0fdf4'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = '10px Segoe UI'; ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right';
        ctx.fillText('₹' + fmtK(maxV * f), P.l - 5, y + 3);
      });

      monthly.forEach((m, i) => {
        const xC = xOf(i);
        rr(ctx, xC - bW - 1, P.t + yS(m.income || 0), bW, ((m.income || 0) / maxV) * cH, 'rgba(22,163,74,.8)');
        rr(ctx, xC + 1, P.t + yS(m.expense || 0), bW, ((m.expense || 0) / maxV) * cH, 'rgba(220,38,38,.7)');
        if (i % Math.ceil(monthly.length / 9) === 0 || i === monthly.length - 1) {
          const ym = m.ym || '';
          const [yr, mo] = (ym.length === 7 ? ym : m.month || '2024-01').split(ym.length === 7 ? '-' : ' ');
          const MNS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const lbl = ym.length === 7 ? MNS[parseInt(mo)] + (yr ? '\'' + yr.slice(2) : '') : (m.month || '').substring(0, 6);
          ctx.font = '10px Segoe UI'; ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center';
          ctx.fillText(lbl, xC, H - P.b + 16);
        }
      });

      ctx.beginPath(); ctx.setLineDash([4, 3]);
      monthly.forEach((m, i) => {
        const x = xOf(i), y = P.t + yS(Math.max(0, m.net || 0));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);

      [[0, 'rgba(22,163,74,.8)', 'Income'], [80, 'rgba(220,38,38,.7)', 'Expense'], [170, '#f59e0b', 'Net Savings']].forEach(([dx, c, lbl]) => {
        ctx.fillStyle = c; ctx.fillRect(P.l + dx, H - 13, 12, 9);
        ctx.font = '11px Segoe UI'; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left';
        ctx.fillText(lbl, P.l + dx + 15, H - 4);
      });
    }

    function rr(ctx, x, y, w, h, c) {
      if (h <= 0 || w <= 0) return;
      const r = Math.min(3, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    }

    /* ═══════════════════════════════════════════════════════════
       CANVAS — DONUT
    ═══════════════════════════════════════════════════════════ */
    function drawDonut(cats) {
      const cv = id('cv-donut'); if (!cv) return;
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
      const top = cats.filter(c => c.total_debit > 0).sort((a, b) => b.total_debit - a.total_debit).slice(0, 9);
      if (!top.length) return;
      const total = top.reduce((s, c) => s + c.total_debit, 0) || 1;
      const cx = 85, cy = 85, R = 68, IR = 34;
      let ang = -Math.PI / 2;
      top.forEach((c, i) => {
        const s = (c.total_debit / total) * 2 * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, ang, ang + s);
        ctx.closePath(); ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.fill(); ang += s;
      });
      ctx.beginPath(); ctx.arc(cx, cy, IR, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.font = 'bold 12px Segoe UI'; ctx.fillStyle = '#374151'; ctx.textAlign = 'center';
      ctx.fillText('Spend', cx, cy - 2);
      ctx.font = '10px Segoe UI'; ctx.fillStyle = '#9ca3af'; ctx.fillText('breakdown', cx, cy + 12);
    }

    /* ═══════════════════════════════════════════════════════════
       CATEGORY LIST
    ═══════════════════════════════════════════════════════════ */
    function renderCatList(cats) {
      const top = cats.filter(c => c.total_debit > 0).sort((a, b) => b.total_debit - a.total_debit).slice(0, 9);
      const maxD = top[0]?.total_debit || 1, totD = top.reduce((s, c) => s + c.total_debit, 0) || 1;
      id('cat-list').innerHTML = top.map((c, i) => `
    <div class="cat-row">
      <div class="cat-dot" style="background:${PALETTE[i % PALETTE.length]}"></div>
      <div class="cat-name">${c.label || c.category}</div>
      <div class="cat-bar"><div class="cat-bar-f" style="width:${Math.round(c.total_debit / maxD * 100)}%;background:${PALETTE[i % PALETTE.length]}"></div></div>
      <div class="cat-amt">₹${fmt(c.total_debit)}</div>
    </div>`).join('');
    }

    /* ═══════════════════════════════════════════════════════════
       WHAT-IF SIMULATOR
    ═══════════════════════════════════════════════════════════ */
    function scheduleWI() {
      clearTimeout(WI_TIMER);
      WI_TIMER = setTimeout(async () => {
        if (!DATA) return;
        try {
          const r = await fetch(API + '/api/whatif', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_number: DATA.account_number,
              on_time_rate: parseFloat(id('ws1').value) / 100,
              has_sip: parseFloat(id('ws2').value) > 0,
              transactions: ALL_TXNS
            })
          });
          const d = await r.json();
          const c = d.projected_color || '#16a34a';
          id('wi-s').textContent = d.projected_score; id('wi-s').style.color = c;
          id('wi-g').textContent = d.projected_grade || '';
          const delta = d.delta || 0;
          id('wi-d').textContent = (delta >= 0 ? '▲ +' : '▼ ') + delta + ' points';
          id('wi-d').style.color = delta >= 0 ? '#15803d' : '#dc2626';
          id('wi-m').textContent = d.message || '';
        } catch (e) { }
      }, 500);
    }
    function resetWI() {
      if (!DATA) return; const fs = DATA.financial_summary || {};
      id('ws1').value = fs.on_time_pct || 90; id('wv1').textContent = (fs.on_time_pct || 90) + '%';
      id('ws2').value = 0; id('wv2').textContent = '₹0';
      id('ws3').value = fs.savings_rate_pct || 20; id('wv3').textContent = (fs.savings_rate_pct || 20) + '%';
      id('wi-s').textContent = DATA.score; id('wi-s').style.color = DATA.grade_color || '#16a34a';
      id('wi-g').textContent = DATA.grade || ''; id('wi-d').textContent = '';
      id('wi-m').textContent = 'Adjust sliders to simulate';
    }

    /* ═══════════════════════════════════════════════════════════
       TRANSACTION TABLE
    ═══════════════════════════════════════════════════════════ */
    function populateCatFilter() {
      const sel = id('tf-cat');
      const cs = [...new Set(ALL_TXNS.map(t => t.category).filter(Boolean))].sort();
      sel.innerHTML = '<option value="">All Categories</option>' + cs.map(c => `<option value="${c}">${c.replace(/_/g, ' ')}</option>`).join('');
    }
    function filterT() {
      const q = (id('tf-q').value || '').toLowerCase();
      const cat = id('tf-cat').value, typ = id('tf-typ').value;
      FILT_TXNS = ALL_TXNS.filter(t =>
        (!q || (t.merchant || '').toLowerCase().includes(q)) &&
        (!cat || t.category === cat) && (!typ || t.type === typ));
      CUR_PAGE = 1; renderTable();
    }
    function renderTable() {
      const start = (CUR_PAGE - 1) * PER;
      const slice = FILT_TXNS.slice(start, start + PER);
      id('tbody').innerHTML = slice.map(t => {
        const cr = t.type === 'CREDIT', late = t.is_late === true;
        const cc = CAT_C[t.category] || '#9ca3af';
        return `<tr class="${late ? 'is-late' : ''}">
      <td style="color:var(--gray400)">${t.date || ''}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${t.merchant || ''}">${(t.merchant || '').substring(0, 38)}</td>
      <td><span class="ttag" style="background:${cc}18;color:${cc}">${(t.category || '').replace(/_/g, ' ')}</span></td>
      <td class="${cr ? 'cr' : 'dr'}">${cr ? '↑' : '↓'} ₹${fmtN(t.amount)}</td>
      <td style="font-size:12px;font-weight:700;color:${cr ? '#15803d' : '#dc2626'}">${t.type}</td>
    </tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--gray400)">No transactions match your filter</td></tr>';

      const pages = Math.ceil(FILT_TXNS.length / PER);
      const pg = id('pg-wrap');
      if (pages <= 1) { pg.innerHTML = ''; } else {
        const ns = [1];
        if (CUR_PAGE > 3) ns.push('…');
        for (let i = Math.max(2, CUR_PAGE - 1); i <= Math.min(pages - 1, CUR_PAGE + 1); i++)ns.push(i);
        if (CUR_PAGE < pages - 2) ns.push('…');
        if (pages > 1) ns.push(pages);
        pg.innerHTML = ns.map(n => n === '…' ? `<span style="color:var(--gray400);font-size:13px">…</span>`
          : `<div class="pg-btn ${n === CUR_PAGE ? 'on' : ''}" onclick="goPage(${n})">${n}</div>`).join('');
      }
      id('tbl-info').textContent = `Showing ${start + 1}–${Math.min(start + PER, FILT_TXNS.length)} of ${FILT_TXNS.length.toLocaleString()} transactions`;
    }
    function goPage(n) { CUR_PAGE = n; renderTable(); id('score-pg').scrollIntoView(); }

    /* ═══════════════════════════════════════════════════════════
       CSV EXPORT
    ═══════════════════════════════════════════════════════════ */
    function exportCSV() {
      const cols = ['date', 'merchant', 'category', 'amount', 'type', 'balance_after', 'is_late'];
      const rows = [cols.join(','), ...FILT_TXNS.map(t => cols.map(c => `"${t[c] ?? ''}"`).join(','))];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
      a.download = `creditiq_${DATA?.account_number || 'export'}.csv`; a.click();
    }

    /* ═══════════════════════════════════════════════════════════
       UTILITIES
    ═══════════════════════════════════════════════════════════ */
    function fmt(n) { n = Math.round(n || 0); if (n >= 10000000) return (n / 1e7).toFixed(1) + 'Cr'; if (n >= 100000) return (n / 1e5).toFixed(1) + 'L'; if (n >= 1000) return (n / 1000).toFixed(1) + 'K'; return n.toLocaleString('en-IN'); }
    function fmtK(n) { if (n >= 100000) return (n / 1e5).toFixed(0) + 'L'; if (n >= 1000) return (n / 1000).toFixed(0) + 'K'; return Math.round(n); }
    function fmtN(n) { return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
    function scoreCol(s) { return s >= 80 ? '#15803d' : s >= 65 ? '#16a34a' : s >= 50 ? '#ca8a04' : s >= 35 ? '#ea580c' : '#dc2626'; }
    function pctFromScore(s) { return s >= 80 ? 88 : s >= 65 ? 70 : s >= 50 ? 48 : s >= 35 ? 28 : 10; }
    function riskLabel(s) { return s >= 80 ? 'Very Low Risk' : s >= 65 ? 'Low Risk' : s >= 50 ? 'Medium Risk' : s >= 35 ? 'High Risk' : 'Very High Risk'; }
  