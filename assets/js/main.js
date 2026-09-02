/* ===== 语言切换 =====
   首屏语言由 <head> 里的内联脚本在渲染前应用，这里只负责切换与持久化。
   各元素的显隐完全交给 CSS 的 [data-lang] 规则，JS 不再逐个去改 display。 */
const langToggle = document.getElementById('langToggle');

function currentLang() {
    return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
}

function applyLang(lang) {
    const root = document.documentElement;
    if (lang === 'en') {
        root.setAttribute('data-lang', 'en');
    } else {
        root.removeAttribute('data-lang');
    }
    root.setAttribute('lang', lang); // 同步语义语言，读屏与翻译工具依赖它
    try { localStorage.setItem('lang', lang); } catch (e) {}

    // 切换语言后让所有入场动画（reveal）重新播放一遍，如同网页首屏加载
    replayReveal();
}

function replayReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    reveals.forEach(function (el) { el.classList.remove('in'); });
    // 强制 reflow，确保浏览器注销旧动画后再重新触发
    void document.body.offsetWidth;
    reveals.forEach(function (el) { el.classList.add('in'); });
}

if (langToggle) {
    langToggle.addEventListener('click', () => {
        applyLang(currentLang() === 'en' ? 'zh' : 'en');
    });
}

/* ===== 主题切换 =====
   橙色色块自上而下直线擦过全屏，在盖满屏幕的瞬间完成主题切换：
   切换过程被完全遮住，也就不会出现“全站元素逐个渐变”的波浪感。 */
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle ? themeToggle.querySelector('use') : null;

function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

function setTheme(dark) {
    if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    if (themeIcon) themeIcon.setAttribute('href', dark ? '#i-moon' : '#i-sun');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
}

function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// 初始化只同步图标状态；主题已由 head 内联脚本应用，不在这里重复写入偏好
if (themeIcon) themeIcon.setAttribute('href', isDark() ? '#i-moon' : '#i-sun');

let wiping = false;

function toggleThemeWithWipe() {
    if (wiping) return;
    wiping = true;
    const next = !isDark();

    if (prefersReducedMotion()) {
        setTheme(next);
        wiping = false;
        return;
    }

    const layer = document.createElement('div');
    layer.className = 'theme-wipe';
    // 擦除层用目标主题的真实背景色（深→#0F0F0F、浅→#FFFFFF），直线擦过时黑白直接变换
    layer.style.setProperty('--wipe-color', next ? '#FFFFFF' : '#0F0F0F');
    document.body.appendChild(layer);

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        layer.remove();
        wiping = false;
    };

    // 动画总时长 0.42s，在 50%（色块刚好盖满屏幕）的那一刻切换主题
    setTimeout(() => setTheme(next), 210);
    layer.addEventListener('animationend', finish);
    setTimeout(finish, 900); // 动画事件意外丢失时的兜底

    requestAnimationFrame(() => layer.classList.add('run'));
}

if (themeToggle) {
    themeToggle.addEventListener('click', toggleThemeWithWipe);
}

const menuToggle = document.getElementById('menuToggle');
const navLinks = document.querySelector('.nav-links');

function copyToClipboard(btn, text) {
    navigator.clipboard.writeText(text).then(function() {
        btn.setAttribute('data-copied', 'true');
        setTimeout(() => {
            btn.setAttribute('data-copied', 'false');
        }, 2000);
    }, function(err) {
        console.error('复制失败: ', err);
    });
}
if (menuToggle && navLinks) {
    const menuIcon = menuToggle.querySelector('use');

    function setMenuOpen(open) {
        navLinks.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        if (menuIcon) menuIcon.setAttribute('href', open ? '#i-close' : '#i-menu');
    }

    menuToggle.addEventListener('click', function () {
        setMenuOpen(!navLinks.classList.contains('active'));
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setMenuOpen(false);
    });
}

/* ===== 滚动：进度条 + 返回顶部 =====
   两者合并进同一帧处理，滚动过程中每帧最多读一次布局；
   进度条用 transform: scaleX() 而非 width，避免触发重排。 */
const backToTopBtn = document.getElementById('backToTop');
const progressBar = document.querySelector('.progress-bar');
let scrollQueued = false;

function updateScrollUI() {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) {
        const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        progressBar.style.transform = 'scaleX(' + ratio + ')';
    }
    if (backToTopBtn) {
        backToTopBtn.classList.toggle('show', window.scrollY > 300);
    }
}

function queueScrollUpdate() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateScrollUI);
}

window.addEventListener('scroll', queueScrollUpdate, { passive: true });
window.addEventListener('resize', queueScrollUpdate, { passive: true });
updateScrollUI();

if (backToTopBtn) {
    backToTopBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* 图片点击放大预览 Lightbox（带缩略图到全屏的连贯过渡动画） */
(function () {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    if (!lightbox || !lightboxImg || !lightboxClose) return;

    const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    // 透明占位图：避免 <img src=""> 被解析成当前页面 URL 而误加载 index.html
    const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    let sourceRect = null;
    let sourceImg = null;
    let sourceCard = null;
    let lastFocused = null; // 打开预览前的焦点元素，关闭后归还给它
    let userScale = 1;
    let userTx = 0, userTy = 0; // 滚轮缩放后拖拽平移的偏移量
    let baseRect = null; // 打开稳定后的原始全屏内容矩形（未受滚轮缩放影响）
    let openSeq = 0;     // 打开/关闭都递增，用于作废迟到的图片 load 回调与关闭清理
    let closing = false; // 关闭动画进行中，忽略重复的关闭触发

    // 应用全屏态的滚动缩放 + 拖拽平移（在打开稳定后的原始全屏态基础上）
    function applyUserTransform(transition) {
        if (transition) {
            lightboxImg.style.transition = transition;
        }
        lightboxImg.style.transform =
            'translate(' + userTx + 'px, ' + userTy + 'px) scale(' + userScale + ')';
    }

    // 根据图片自身的 object-fit，计算其在盒子内实际可见的内容矩形
    // 全屏图固定 contain；缩略图可能是 cover（裁切填满）或 contain（完整居中）
    function contentRect(img, box) {
        const fit = (getComputedStyle(img).objectFit || 'fill');
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        if (!iw || !ih) return box;
        const boxRatio = box.width / box.height;
        const imgRatio = iw / ih;
        let w, h;
        if (fit === 'cover') {
            w = box.width;
            h = box.height;
        } else { // contain（含 fill 回退为 contain 测量）
            if (imgRatio > boxRatio) {
                w = box.width;
                h = box.width / imgRatio;
            } else {
                h = box.height;
                w = box.height * imgRatio;
            }
        }
        return {
            left: box.left + (box.width - w) / 2,
            top: box.top + (box.height - h) / 2,
            width: w,
            height: h
        };
    }

    // 以“内容矩形”做 FLIP：等比缩放，保证动画中图片不变形
    // finalRect 默认为实时测量（打开飞入时用）；关闭飞回时传入记录的原始全屏态，排除滚轮缩放干扰
    function fitTransform(rect, finalRect) {
        if (!finalRect) {
            finalRect = contentRect(lightboxImg, lightboxImg.getBoundingClientRect());
        }
        if (!finalRect.width || !finalRect.height) return null;
        const dx = (rect.left + rect.width / 2) - (finalRect.left + finalRect.width / 2);
        const dy = (rect.top + rect.height / 2) - (finalRect.top + finalRect.height / 2);
        const scale = rect.width / finalRect.width; // 等比，避免 contain 图被拉伸
        return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
    }

    function openLightbox(img) {
        closing = false; // 重新打开会打断进行中的关闭流程
        const seq = ++openSeq;
        if (sourceImg && sourceImg !== img) {
            sourceImg.style.visibility = '';
            sourceImg = null;
        }
        if (sourceCard) {
            sourceCard.classList.remove('active');
            sourceCard = null;
        }
        const card = img.closest('.project-card, .experience-card');
        if (card) {
            card.classList.add('active'); // 让卡片保持悬停态层叠效果
            sourceCard = card;
        }
        sourceRect = contentRect(img, img.getBoundingClientRect()); // 取悬停态位移后的位置
        sourceImg = img;
        userScale = 1; // 重置滚轮缩放
        userTx = 0;
        userTy = 0; // 重置拖拽平移
        img.style.visibility = 'hidden'; // 隐藏原位图，由 lightbox 图从原位飞出
        // 全屏 object-fit 跟随缩略图：cover→cover、contain→contain，避免返回时裁切跳变
        lightboxImg.style.objectFit = getComputedStyle(img).objectFit || 'contain';
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || '';
        document.body.style.overflow = 'hidden';
        lastFocused = document.activeElement;
        lightbox.focus({ preventScroll: true });

        const start = function () {
            lightboxImg.onload = null;
            lightboxImg.onerror = null;
            if (seq !== openSeq) return; // 期间被关闭/重开，迟到的 load 回调直接作废
            lightbox.classList.add('open', 'active');
            const t = fitTransform(sourceRect);
            baseRect = contentRect(lightboxImg, lightboxImg.getBoundingClientRect()); // 记录原始全屏态
            if (t) {
                lightboxImg.style.transition = 'none';
                lightboxImg.style.transform = t;
                // 强制回流，确保初始 transform 生效
                lightboxImg.getBoundingClientRect();
            }
            requestAnimationFrame(function () {
                if (t) {
                    lightboxImg.style.transition = 'transform 0.3s ' + EASING;
                    lightboxImg.style.transform = 'translate(0, 0) scale(1)';
                }
                lightboxClose.classList.add('show'); // 关闭按钮擦除出现
            });
        };

        if (lightboxImg.complete && lightboxImg.naturalWidth) {
            start();
        } else {
            lightboxImg.onload = start;
            lightboxImg.onerror = start;
        }
    }

    // 关闭预览后把焦点还给触发它的元素，键盘用户不会“丢失位置”
    function restoreFocus() {
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus({ preventScroll: true });
        }
        lastFocused = null;
    }

    function closeLightbox() {
        openSeq++; // 作废尚未触发的 start 回调，避免关闭后黑屏闪回
        if (closing) return;
        closing = true;
        if (!sourceRect) {
            lightbox.classList.remove('active', 'open');
            lightboxClose.classList.remove('show');
            document.body.style.overflow = '';
            if (sourceImg) {
                sourceImg.style.visibility = '';
                sourceImg = null;
            }
            if (sourceCard) {
                sourceCard.classList.remove('active');
                sourceCard = null;
            }
            userScale = 1;
            userTx = 0;
            userTy = 0;
            baseRect = null;
            restoreFocus();
            closing = false;
            return;
        }
        const t = fitTransform(sourceRect, baseRect); // 以原始全屏态为基准，缩放可平滑回落
        lightbox.classList.remove('active'); // 背景遮罩开始淡出，图片仍清晰飞回
        lightboxClose.classList.remove('show'); // 关闭按钮擦除消失
        if (t) {
            lightboxImg.style.transition = 'transform 0.3s ' + EASING;
            lightboxImg.style.transform = t;
        }
        // 飞回动画结束后再隐藏遮罩并清理；期间若重新打开（openSeq 变化）则本次清理作废
        const seq = openSeq;
        setTimeout(function () {
            if (seq !== openSeq) return;
            closing = false;
            lightboxImg.onload = null;
            lightboxImg.onerror = null;
            lightbox.classList.remove('open');
            lightboxImg.src = PLACEHOLDER;
            lightboxImg.style.transform = '';
            lightboxImg.style.objectFit = '';
            lightboxClose.classList.remove('show');
            document.body.style.overflow = '';
            userScale = 1;
            userTx = 0;
            userTy = 0;
            baseRect = null;
            if (sourceImg) {
                sourceImg.style.visibility = '';
                sourceImg = null;
            }
            if (sourceCard) {
                sourceCard.classList.remove('active');
                sourceCard = null;
            }
            sourceRect = null;
            restoreFocus();
        }, 300);
    }

    document.querySelectorAll('img.zoomable').forEach(function (img) {
        img.addEventListener('click', function (e) {
            e.stopPropagation();
            openLightbox(img);
        });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') {
            closeLightbox();
            return;
        }
        // 模态期间把焦点锁在关闭按钮上，避免 Tab 跑到背后的页面内容里
        if (e.key === 'Tab') {
            e.preventDefault();
            lightboxClose.focus();
        }
    });

    // 全屏状态下滚轮进一步缩放图片（以中心为基准，范围 0.5x~6x）
    lightbox.addEventListener('wheel', function (e) {
        if (!lightbox.classList.contains('open')) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        userScale = Math.min(6, Math.max(0.5, userScale * factor));
        applyUserTransform('transform 0.12s ease-out');
    }, { passive: false });

    // 滚轮缩放后允许鼠标拖拽平移（缩放 > 1 时才可平移）
    let dragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragOrigTx = 0, dragOrigTy = 0;

    lightboxImg.addEventListener('mousedown', function (e) {
        if (userScale <= 1) return; // 未放大不触发拖拽
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragOrigTx = userTx;
        dragOrigTy = userTy;
        lightboxImg.style.transition = 'none';
        lightbox.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        userTx = dragOrigTx + (e.clientX - dragStartX);
        userTy = dragOrigTy + (e.clientY - dragStartY);
        applyUserTransform('none');
    });

    window.addEventListener('mouseup', function () {
        if (!dragging) return;
        dragging = false;
        lightbox.style.cursor = 'zoom-out';
    });

    // 移动端触摸支持：双指捏合缩放 + 单指拖拽平移 + 轻点关闭
    let touchMode = false;          // 本次触摸是否为双指捏合
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let touchStartX = 0, touchStartY = 0;
    let touchOrigTx = 0, touchOrigTy = 0;
    let touchMoved = false;         // 单指是否发生移动（用于区分轻点与拖拽）

    function touchDist(t) {
        const dx = t[0].clientX - t[1].clientX;
        const dy = t[0].clientY - t[1].clientY;
        return Math.hypot(dx, dy);
    }

    lightboxImg.addEventListener('touchstart', function (e) {
        if (!lightbox.classList.contains('open')) return;
        if (e.touches.length === 2) {
            touchMode = true;
            touchMoved = true; // 双指不视为轻点
            pinchStartDist = touchDist(e.touches);
            pinchStartScale = userScale;
            lightboxImg.style.transition = 'none';
            e.preventDefault();
        } else if (e.touches.length === 1) {
            touchMode = false;
            touchMoved = false;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchOrigTx = userTx;
            touchOrigTy = userTy;
            lightboxImg.style.transition = 'none';
        }
    }, { passive: false });

    lightboxImg.addEventListener('touchmove', function (e) {
        if (!lightbox.classList.contains('open')) return;
        e.preventDefault();
        if (e.touches.length === 2 && touchMode) {
            const dist = touchDist(e.touches);
            if (pinchStartDist > 0) {
                userScale = Math.min(6, Math.max(0.5, pinchStartScale * dist / pinchStartDist));
                applyUserTransform('none');
            }
        } else if (e.touches.length === 1 && !touchMode && userScale > 1) {
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) touchMoved = true;
            userTx = touchOrigTx + dx;
            userTy = touchOrigTy + dy;
            applyUserTransform('none');
        }
    }, { passive: false });

    lightboxImg.addEventListener('touchend', function (e) {
        if (!lightbox.classList.contains('open')) return;
        // 单指轻点（未移动、未捏合）且作用在图片上 → 关闭预览
        if (e.touches.length === 0 && !touchMode && !touchMoved) {
            closeLightbox();
        }
        touchMode = false;
    }, { passive: false });
})();

/* 图片加载遮罩：加载完成前持续播放 spinner；加载完成时等当前循环播完再完整擦除收尾 */
(function () {
    document.querySelectorAll('.img-loader').forEach(function (container) {
        const img = container.querySelector('img');
        const cover = container.querySelector('.img-cover');
        if (!img || !cover) return;

        let loaded = false;

        function finish() {
            loaded = true;
        }

        if (img.complete) {
            finish();
        } else {
            img.addEventListener('load', finish);
            img.addEventListener('error', finish);
        }

        // 图片加载完成后，等当前这一个完整周期（出现→消失）播完再隐藏遮罩，避免跳帧
        const onIteration = function () {
            if (loaded) {
                cover.classList.add('done');
                cover.removeEventListener('animationiteration', onIteration);
            }
        };
        cover.addEventListener('animationiteration', onIteration);
    });
})();

/* ===== 滚动入场动效 =====
   首屏之外的内容滚动到视口时依次浮现；同一容器内的卡片做 stagger。
   .reveal 类由 JS 添加，脚本未执行时内容仍正常可见。 */
(function () {
    const targets = document.querySelectorAll(
        '.section-title, .section-note, .project-category-title, .project-card, ' +
        '.experience-card, .stack-category, .about-content, .spotify-embed'
    );
    if (!targets.length) return;

    const counters = new Map();
    targets.forEach(function (el) {
        const parent = el.parentElement;
        const index = counters.get(parent) || 0;
        counters.set(parent, index + 1);
        el.classList.add('reveal');
        el.style.setProperty('--i', String(Math.min(index, 6)));
    });

    // 不支持 IntersectionObserver 时直接显示，避免内容永远停在透明状态
    if (!('IntersectionObserver' in window)) {
        targets.forEach(function (el) { el.classList.add('in'); });
        return;
    }

    const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('in');
            io.unobserve(entry.target); // 只播一次
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    targets.forEach(function (el) { io.observe(el); });
})();

/* ===== 导航高亮（scrollspy） ===== */
(function () {
    const links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    const sectionToLink = new Map();
    links.forEach(function (link) {
        const section = document.querySelector(link.getAttribute('href'));
        if (section) sectionToLink.set(section, link);
    });
    if (!sectionToLink.size) return;

    const visible = new Set();

    function highlight() {
        let active = null;
        // Map 保持插入顺序（即文档顺序），取最靠上的可见区块
        sectionToLink.forEach(function (link, section) {
            if (!active && visible.has(section)) active = link;
        });
        links.forEach(function (link) {
            link.classList.toggle('active', link === active);
        });
    }

    // 视口中段的一条检测带，区块进入即视为“当前章节”
    const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
        });
        highlight();
    }, { rootMargin: '-25% 0px -60% 0px' });

    sectionToLink.forEach(function (_link, section) { io.observe(section); });
})();

/* Spotify 播放状态广播：播放器模块写入，背景粒子模块读取（伪律动共享状态） */
const spotifyGroove = { playing: false, bpm: 100 };

/* ===== 背景粒子流（大小不一的橙色方框描边；Spotify 播放时按节拍伪律动） ===== */
(function () {
    if (prefersReducedMotion()) return; // 尊重“减少动态效果”
    const canvas = document.getElementById('bgParticles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1, particles = [];

    // 伪律动：跨域 + DRM 决定拿不到 Spotify 真实音频频谱，用播放状态 + 合成节拍模拟
    let grooveMix = 0;   // 律动强度 0~1，播放/暂停间平滑过渡
    let groovePhase = 0; // 节拍相位（秒）

    // 鼠标回避：粒子在光标附近只做水平让位，垂直上浮速度不受影响
    const DODGE_R = 110; // 影响半径（px）
    const DODGE_V = 240; // 最大回避速度（px/s）
    const pointer = { x: -9999, y: -9999, active: false };

    function spawn(initial) {
        const size = 4 + Math.random() * 12; // 4~16px 大小不一的方框，呼应纯直角
        return {
            x: Math.random() * w,
            y: initial ? Math.random() * h : h + size,
            s: size,
            vy: 6 + Math.random() * 14,        // 每秒上移像素
            vx: (Math.random() - 0.5) * 6,
            a: 0.08 + Math.random() * 0.12,    // 低透明度，保持克制
            phase: Math.random() * Math.PI * 2,
            sway: 4 + Math.random() * 8
        };
    }
    function build() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.max(18, Math.min(60, Math.round(w * h / 26000)));
        particles = [];
        for (let i = 0; i < count; i++) particles.push(spawn(true));
    }
    let last = 0, raf = 0, running = true;
    function frame(t) {
        if (!running) return;
        if (!last) last = t;
        let dt = (t - last) / 1000;
        last = t;
        if (dt > 0.05) dt = 0.05; // 卡顿 / 切回标签页时兜底
        ctx.clearRect(0, 0, w, h);

        // 节拍律动：每拍起跳后指数衰减，模拟重低音的“砸拍”感；暂停时平滑归零
        groovePhase += dt;
        grooveMix += ((spotifyGroove.playing ? 1 : 0) - grooveMix) * Math.min(1, dt * 4);
        const beatT = (groovePhase * spotifyGroove.bpm / 60) % 1;
        const boost = grooveMix * Math.exp(-5 * beatT);

        for (const p of particles) {
            p.y -= p.vy * (1 + 1.1 * grooveMix) * dt; // 播放时上浮加速
            p.phase += dt;
            p.x += (p.vx * (1 + grooveMix) + Math.sin(p.phase) * p.sway * 0.3) * dt;
            // 水平回避：方向沿 (dx/(|dx|+软化项)) 平滑过渡，光标正上方时不抖动
            if (pointer.active) {
                const dx = p.x - pointer.x;
                const dy = p.y - pointer.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < DODGE_R) {
                    p.x += (dx / (Math.abs(dx) + 24)) * (1 - d / DODGE_R) * DODGE_V * dt;
                }
            }
            if (p.y < -p.s) Object.assign(p, spawn(false));
            if (p.x < -p.s) p.x = w + p.s;
            else if (p.x > w + p.s) p.x = -p.s;
            const s = p.s * (1 + 0.22 * boost); // 拍点上轻微放大
            const off = (p.s - s) / 2;          // 以中心为锚点放大（抵消 strokeRect 左上角起画）
            ctx.strokeStyle = 'rgba(255,102,0,' + Math.min(0.55, p.a * (1 + 2.2 * boost)).toFixed(3) + ')';
            ctx.lineWidth = 3; // 线宽统一 3px
            ctx.strokeRect(p.x + off, p.y + off, s, s); // 方框描边（非实心）
        }
        raf = requestAnimationFrame(frame);
    }
    build();
    raf = requestAnimationFrame(frame);
    window.addEventListener('pointermove', function (e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
    }, { passive: true });
    window.addEventListener('resize', function () {
        cancelAnimationFrame(raf);
        build();
        raf = requestAnimationFrame(frame);
    });
    // 标签页隐藏时暂停渲染，省电
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            running = false;
            cancelAnimationFrame(raf);
        } else if (!running) {
            running = true;
            last = 0;
            raf = requestAnimationFrame(frame);
        }
    });
})();

/* ===== Footer 几何脉冲矩阵（鼠标联动，纯装饰，无音频捕获） =====
   平静态：画布完全空白，footer 与普通页面无异。
   鼠标进入后：以光标所在格为中心亮起一圈圈实心方块组成的同心方环，
   按 9Hz 整数节拍硬切换亮/灭；光标压过的格子留下短促的实心轨迹。
   网格整体居中，边缘不会出现被裁切的半截方块。
   律动由内置合成重低音节拍驱动，不依赖任何音频捕获（应需求移除 ♪ 捕获）。 */
(function () {
    if (prefersReducedMotion()) return;
    const footer = document.querySelector('footer');
    const canvas = document.getElementById('footerFx');
    if (!footer || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = 20;   // 网格步长（px）
    const INSET = 4;   // 方块相对格子的内缩，形成正交缝隙
    const MARGIN = 8;  // 文字遮挡区外扩留白，避免方块紧贴文字
    const FLICK = 9;   // 闪烁节拍（Hz），状态整帧硬切换
    const R = 8;       // 影响半径（格），切比雪夫距离 → 同心方环
    // 离散透明度台阶（posterize）：档位硬跳，不做丝滑渐变
    const LEVELS = [0.20, 0.42, 0.65, 0.85];
    const BPM = 100;             // 合成重低音节拍速度
    const BEAT = 60 / BPM;       // 单拍时长（秒）

    let w = 0, h = 0, dpr = 1, cols = 0, rows = 0;
    let offX = 0, offY = 0;   // 网格整体居中偏移，保证边缘不被裁切
    let cx = -1, cy = -1;      // 光标所在网格坐标
    let px = -100, py = -100;  // 光标像素坐标（画十字线用）
    let inside = false;
    let inView = false, running = false, raf = 0, last = 0, t = 0;
    const trail = new Map();   // "i,j" -> 到期时间戳，到点瞬间熄灭
    const textEl = footer.querySelector('p'); // 版权文字，画布在其区域留白
    let maskRect = null;                      // 文字区域（画布坐标），方块避让

    // 用 Range 量取文字内容的紧致包围盒（贴着字形，而非整行 line-box），
    // 避免 p 的 line-height/基线导致遮罩在文字下方留白偏多；每帧重算以适配语言切换导致的宽度变化。
    function computeMask() {
        if (!textEl) { maskRect = null; return; }
        const fr = footer.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(textEl);
        const tr = range.getBoundingClientRect();
        maskRect = {
            x: tr.left - fr.left - MARGIN,
            y: tr.top - fr.top - MARGIN,
            w: tr.width + MARGIN * 2,
            h: tr.height + MARGIN * 2
        };
    }

    // 确定性整数散列：同一格在同一节拍内状态稳定，节拍推进即硬切换
    function hash(x, y, k) {
        let n = (x * 374761393 + y * 668265263 + k * 1274126177) | 0;
        n = Math.imul(n ^ (n >>> 13), 1103515245);
        n = n ^ (n >>> 16);
        return (n >>> 0) / 4294967295;
    }

    function build() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = footer.clientWidth;
        h = footer.clientHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 只取完整的格子数，并把整张网格居中 → 边缘不会出现被裁切的半截方块
        cols = Math.max(1, Math.floor(w / CELL));
        rows = Math.max(1, Math.floor(h / CELL));
        offX = (w - cols * CELL) / 2;
        offY = (h - rows * CELL) / 2;
        trail.clear();
    }

    function cellRect(i, j) {
        const x = offX + i * CELL + INSET;
        const y = offY + j * CELL + INSET;
        const s = CELL - INSET * 2;
        if (maskRect &&
            x < maskRect.x + maskRect.w && x + s > maskRect.x &&
            y < maskRect.y + maskRect.h && y + s > maskRect.y) {
            return; // 落在版权文字区域，留白不画
        }
        ctx.fillRect(x, y, s, s);
    }

    function frame(now) {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (!last) last = now;
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05; // 卡顿 / 切回标签页时兜底
        t += dt;
        computeMask(); // 每帧更新文字遮挡区（适配语言切换后的宽度）

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#FF6600';

        // 同心方环：各环"被点亮"的概率按切比雪夫距离阶梯下降；
        // 点亮的格子再按离散台阶取透明度（档位硬跳，非丝滑渐变）。
        // 整个方阵随内置合成重低音节拍律动：起拍最密最亮、向外扩张，随后衰减。
        if (inside && cx >= 0) {
            const k = Math.floor(t * FLICK);
            const phase = (t % BEAT) / BEAT;
            let kick = Math.exp(-phase * 6);
            if (phase > 0.5) kick = Math.max(kick, 0.5 * Math.exp(-(phase - 0.5) * 6));
            const level = kick;
            const rEff = R + Math.round(level * 3); // 起拍/重拍时方阵向外扩张
            for (let dj = -rEff; dj <= rEff; dj++) {
                const j = cy + dj;
                if (j < 0 || j >= rows) continue;
                for (let di = -rEff; di <= rEff; di++) {
                    const i = cx + di;
                    if (i < 0 || i >= cols) continue;
                    const d = Math.max(Math.abs(di), Math.abs(dj));
                    // 密度随律动起伏
                    const base = d <= 2 ? 0.95 : d <= 4 ? 0.60 : d <= 6 ? 0.32 : 0.12;
                    const thr = base * (0.2 + 0.8 * level);
                    const v = hash(i, j, k);
                    if (v < thr) {
                        // 亮度随律动起伏（档位硬跳，非丝滑渐变）
                        const idx = Math.floor(hash(i, j, k + 1) * LEVELS.length);
                        const lv = Math.min(1, LEVELS[idx] * (0.4 + 0.7 * level));
                        ctx.fillStyle = 'rgba(255, 102, 0, ' + lv + ')';
                        cellRect(i, j);
                    }
                }
            }
        }

        // 移动轨迹：光标压过的格子亮起（实心满不透明），随机时长后瞬间熄灭（不渐隐）
        ctx.fillStyle = '#FF6600';
        for (const [key, expire] of trail) {
            if (now >= expire) { trail.delete(key); continue; }
            const sep = key.indexOf(',');
            cellRect(+key.slice(0, sep), +key.slice(sep + 1));
        }
    }

    function start() {
        if (running) return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
    }
    function stop() {
        running = false;
        cancelAnimationFrame(raf);
    }

    footer.addEventListener('mousemove', function (e) {
        const rect = footer.getBoundingClientRect();
        px = e.clientX - rect.left;
        py = e.clientY - rect.top;
        cx = Math.floor((px - offX) / CELL);
        cy = Math.floor((py - offY) / CELL);
        inside = true;
        footer.classList.add('hot'); // 版权文字与上边框硬切换为主色

        // 轨迹格子：只记录光标当前格，250~700ms 后瞬间熄灭
        const key = cx + ',' + cy;
        if (!trail.has(key)) {
            trail.set(key, performance.now() + 250 + Math.random() * 450);
        }
    });
    footer.addEventListener('mouseleave', function () {
        inside = false;
        footer.classList.remove('hot');
    });

    window.addEventListener('resize', build);

    // 只在 footer 进入视口时渲染
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                inView = entry.isIntersecting;
                if (inView) start();
                else stop();
            });
        }, { threshold: 0 });
        io.observe(footer);
    } else {
        inView = true;
        start();
    }

    // 标签页隐藏时暂停，恢复后仅在 footer 可见时继续
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stop();
        } else if (inView) {
            start();
        }
    });

    build();
})();

/* ===== Spotify 播放器：IFrame API 接管 + 主题跟随 + 播放状态广播 =====
   用官方 IFrame API 创建播放器以拿到 playback_update 事件（isPaused），
   写入 spotifyGroove 驱动背景粒子伪律动（跨域 + DRM 拿不到真实音频频谱）。
   Embed options 官方只支持 uri/url/width/height，theme 参数靠 URL 查询串透传（尽力而为），
   主题切换通过整卡重建实现（与旧方案一样音乐重新开始）。
   API 脚本加载失败（如网络不通）时自动回退静态 iframe，播放器始终可用。 */
(function () {
    const HOST = document.querySelector('.spotify-embed');
    if (!HOST) return;

    // 换歌单只需改这一处（歌单页 URL open.spotify.com/playlist/XXXXXXXX 里的 XXXXXXXX）
    const PLAYLIST_ID = '7EMV7PM2opruGcHFrrNWtf';
    const CONTENT_URL = 'https://open.spotify.com/playlist/' + PLAYLIST_ID;
    const EMBED_BASE = 'https://open.spotify.com/embed/playlist/' + PLAYLIST_ID + '?utm_source=generator';

    let api = null;            // IFrameAPI 引用（onSpotifyIframeApiReady 时赋值）
    let built = false;         // 播放器是否已创建（API 版或回退版）
    let usingFallback = false; // 是否已回退为静态 iframe

    function embedSrc() {
        // 亮色模式追加 theme=0（白底）；暗色用默认（黑底），故不追加参数
        return isDark() ? EMBED_BASE : EMBED_BASE + '&theme=0';
    }

    function fallbackHtml() {
        return '<iframe title="Sam-Fic 的 Spotify 歌单" width="100%" height="352" frameborder="0" ' +
            'loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
            'src="' + embedSrc() + '"></iframe>';
    }

    function attachController(ctrl) {
        const add = ctrl.addListener || ctrl.addEventListener;
        if (add) {
            add.call(ctrl, 'playback_update', function (e) {
                spotifyGroove.playing = !!(e && e.data && e.data.isPaused === false);
            });
        }
    }

    function build() {
        built = true;
        spotifyGroove.playing = false; // 旧控制器随重建销毁，先复位律动状态
        HOST.querySelectorAll('iframe, #spotifyPlayer').forEach(function (n) { n.remove(); });
        const el = document.createElement('div');
        el.id = 'spotifyPlayer';
        HOST.appendChild(el);
        if (api) {
            // URL 查询参数随 options.url 透传给 Embed，主题借此生效（不透传则退化为暗色）
            api.createController(el, {
                url: CONTENT_URL + '?utm_source=generator' + (isDark() ? '' : '&theme=0'),
                width: '100%',
                height: 352
            }, attachController);
        } else {
            usingFallback = true;
            el.outerHTML = fallbackHtml();
        }
    }

    // 给 API 脚本 2.5s 窗口，超时则回退静态 iframe（期间卡片短暂空白，属可接受代价）
    const graceTimer = setTimeout(function () { if (!built) build(); }, 2500);
    window.onSpotifyIframeApiReady = function (IFrameAPI) {
        clearTimeout(graceTimer);
        api = IFrameAPI;
        if (!built) build();
    };

    if (themeToggle) {
        // 主题切换在擦除动画 50% 处（约 210ms）真正生效，这里稍后同步
        themeToggle.addEventListener('click', function () {
            setTimeout(function () {
                if (!built) return;
                if (usingFallback) {
                    const f = HOST.querySelector('iframe');
                    if (f) f.src = embedSrc();
                } else {
                    build(); // 重建控制器以套用新主题（音乐会重新开始）
                }
            }, 230);
        });
    }

    // Spotify iframe 在切歌 / 开始播放时内部会夺焦，浏览器随之把 iframe 滚进视野，页面跳到「关于我」。
    // 拦截：焦点落在播放器 iframe 上且发生了滚动 → 立即归还焦点并还原滚动位置。
    // 焦点归还后 activeElement 不再是 iframe，用户自己随后的滚动不受影响。
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', function () {
        const f = HOST.querySelector('iframe');
        if (f && document.activeElement === f) {
            f.blur();
            window.scrollTo(0, lastScrollY);
        } else {
            lastScrollY = window.scrollY;
        }
    }, { passive: true });
})();