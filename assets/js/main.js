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