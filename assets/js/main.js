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
            return;
        }
        const t = fitTransform(sourceRect, baseRect); // 以原始全屏态为基准，缩放可平滑回落
        lightbox.classList.remove('active'); // 背景遮罩开始淡出，图片仍清晰飞回
        lightboxClose.classList.remove('show'); // 关闭按钮擦除消失
        if (t) {
            lightboxImg.style.transition = 'transform 0.3s ' + EASING;
            lightboxImg.style.transform = t;
        }
        // 飞回动画结束后再隐藏遮罩并清理
        setTimeout(function () {
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
        '.experience-card, .stack-category, .about-content'
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