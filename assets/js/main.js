const langToggle = document.getElementById('langToggle');

function getPreferredLang() {
    const userLang = navigator.language.toLowerCase();
    if (userLang.includes('zh')) return 'zh';
    return 'en';
}

function applyLang(lang) {
    if (lang === 'en') {
        document.documentElement.setAttribute('data-lang', 'en');
        langToggle.querySelector('[lang="zh"]').style.display = 'none';
        langToggle.querySelector('[lang="en"]').style.display = 'inline';
    } else {
        document.documentElement.removeAttribute('data-lang');
        langToggle.querySelector('[lang="zh"]').style.display = 'inline';
        langToggle.querySelector('[lang="en"]').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyLang(getPreferredLang());
});

langToggle.addEventListener('click', () => {
    const isEn = document.documentElement.getAttribute('data-lang') === 'en';
    applyLang(isEn ? 'zh' : 'en');
});

const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.material-icons');
const favicon = document.getElementById('favicon');

function updateFavicon() {
    favicon.href = 'assets/images/avatar.png';
}

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIcon.textContent = 'dark_mode';
}
updateFavicon();

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = 'wb_sunny';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.textContent = 'dark_mode';
    }
    updateFavicon();
});

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
    menuToggle.addEventListener('click', function() {
        navLinks.classList.toggle('active');
        const icon = menuToggle.querySelector('.material-icons');
        if (icon) {
            icon.textContent = navLinks.classList.contains('active') ? 'close' : 'menu';
        }
    });

    navLinks.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
            navLinks.classList.remove('active');
            const icon = menuToggle.querySelector('.material-icons');
            if (icon) {
                icon.textContent = 'menu';
            }
        });
    });
}

const backToTopBtn = document.getElementById('backToTop');
if (backToTopBtn) {
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });

    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

const progressBar = document.querySelector('.progress-bar');
if (progressBar) {
    window.addEventListener('scroll', function() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
    });
}

/* 图片点击放大预览 Lightbox（带缩略图到全屏的连贯过渡动画） */
(function () {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    if (!lightbox || !lightboxImg || !lightboxClose) return;

    const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    let sourceRect = null;
    let sourceImg = null;
    let sourceCard = null;
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
            lightboxImg.src = '';
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
        if (e.key === 'Escape' && lightbox.classList.contains('open')) {
            closeLightbox();
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
        cover.addEventListener('animationiteration', function () {
            if (loaded) {
                cover.classList.add('done');
                cover.removeEventListener('animationiteration', arguments.callee);
            }
        });
    });
})();