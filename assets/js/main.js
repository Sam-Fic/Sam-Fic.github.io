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
    function fitTransform(rect) {
        const finalBox = lightboxImg.getBoundingClientRect();
        const finalRect = contentRect(lightboxImg, finalBox);
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
        img.style.visibility = 'hidden'; // 隐藏原位图，由 lightbox 图从原位飞出
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || '';
        document.body.style.overflow = 'hidden';

        const start = function () {
            lightbox.classList.add('open', 'active');
            const t = fitTransform(sourceRect);
            if (t) {
                lightboxImg.style.transition = 'none';
                lightboxImg.style.transform = t;
                // 强制回流，确保初始 transform 生效
                lightboxImg.getBoundingClientRect();
                requestAnimationFrame(function () {
                    lightboxImg.style.transition = 'transform 0.3s ' + EASING;
                    lightboxImg.style.transform = 'translate(0, 0) scale(1)';
                });
            }
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
            document.body.style.overflow = '';
            if (sourceImg) {
                sourceImg.style.visibility = '';
                sourceImg = null;
            }
            if (sourceCard) {
                sourceCard.classList.remove('active');
                sourceCard = null;
            }
            return;
        }
        const t = fitTransform(sourceRect);
        lightbox.classList.remove('active'); // 背景遮罩开始淡出，图片仍清晰飞回
        if (t) {
            lightboxImg.style.transition = 'transform 0.3s ' + EASING;
            lightboxImg.style.transform = t;
        }
        // 飞回动画结束后再隐藏遮罩并清理
        setTimeout(function () {
            lightbox.classList.remove('open');
            lightboxImg.src = '';
            lightboxImg.style.transform = '';
            document.body.style.overflow = '';
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