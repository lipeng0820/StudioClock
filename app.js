/**
 * StudioClock - 演播室时钟应用
 * 专业直播倒计时时钟
 */

// ===== 工具函数 =====

/**
 * 安全解析 JSON，失败时返回默认值
 */
function safeJSONParse(str, defaultValue = {}) {
    try {
        return str ? JSON.parse(str) : defaultValue;
    } catch (e) {
        console.warn('JSON 解析失败:', e);
        return defaultValue;
    }
}

/**
 * 验证时间格式 HH:MM:SS
 */
function isValidTimeFormat(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return false;
    const pattern = /^([01]?\d|2[0-3]):([0-5]?\d):([0-5]?\d)$/;
    return pattern.test(timeStr);
}

/**
 * 解析时间字符串为时分秒数组
 */
/**
 * 解析时间字符串为时分秒对象
 * 支持格式：HH:MM:SS, HH:MM, HH, HHMM, HMM, HHMMSS
 * 自动处理全角冒号
 */
function parseTimeString(timeStr) {
    if (!timeStr) return null;

    // 1. 替换全角字符为半角，移除空格
    let normalized = timeStr
        .trim()
        .replace(/：/g, ':')  // 中文冒号
        .replace(/。/g, '.')  // 中文句号
        .replace(/\s+/g, ''); // 空格

    let hours = 0, minutes = 0, seconds = 0;

    // 2. 如果包含分隔符（: 或 .）
    if (normalized.includes(':') || normalized.includes('.')) {
        const parts = normalized.replace(/\./g, ':').split(':').map(str => str === '' ? 0 : Number(str));
        hours = parts[0];
        minutes = parts.length > 1 ? parts[1] : 0;
        seconds = parts.length > 2 ? parts[2] : 0;
    }
    // 3. 纯数字处理
    else if (/^\d+$/.test(normalized)) {
        const len = normalized.length;
        if (len <= 2) {
            hours = parseInt(normalized); // H or HH
        } else if (len === 3) {
            hours = parseInt(normalized.slice(0, 1)); // HMM
            minutes = parseInt(normalized.slice(1));
        } else if (len === 4) {
            hours = parseInt(normalized.slice(0, 2)); // HHMM
            minutes = parseInt(normalized.slice(2));
        } else if (len === 5) {
            hours = parseInt(normalized.slice(0, 1)); // HMMSS
            minutes = parseInt(normalized.slice(1, 3));
            seconds = parseInt(normalized.slice(3));
        } else if (len === 6) {
            hours = parseInt(normalized.slice(0, 2)); // HHMMSS
            minutes = parseInt(normalized.slice(2, 4));
            seconds = parseInt(normalized.slice(4));
        } else {
            return null;
        }
    } else {
        return null;
    }

    // 验证数值有效性
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;
    if (seconds < 0 || seconds > 59) return null;

    return { hours, minutes, seconds };
}

// ===== CSS 变量颜色值（与 styles.css 保持一致） =====
const COLORS = {
    red: 'var(--color-red, #ff3b3b)',
    green: 'var(--color-green, #00e676)',
    orange: 'var(--color-orange, #ffab40)'
};

// ===== StudioClock 类 =====

class StudioClock {
    constructor(container, index, onRemove) {
        this.container = container;
        this.index = index;
        this.onRemove = onRemove; // 删除回调
        this.startTime = null;
        this.createClockElement();
        this.loadSettings();
    }

    createClockElement() {
        this.element = document.createElement('div');
        this.element.className = 'clock-container';
        this.element.dataset.clockIndex = this.index;
        this.element.innerHTML = `
            <div class="project-header">
                <div class="project-name" contenteditable="true">项目 ${this.index + 1}</div>
                <div class="edit-icon project-edit-icon" title="编辑项目名称">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </div>
            </div>
            <div class="clocks">
                <div class="clock" id="startTime">
                    <div class="clock-header">
                        <div class="clock-title">开播时间</div>
                        <div class="edit-icon time-edit-icon" title="修改开播时间">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </div>
                    </div>
                    <div class="clock-time"></div>
                </div>
                <div class="clock-divider"></div>
                <div class="clock" id="localTime">
                    <div class="clock-title">当地时间</div>
                    <div class="clock-time"></div>
                    <div class="status"></div>
                </div>
                <div class="clock-divider"></div>
                <div class="clock" id="countdown">
                    <div class="clock-title">倒计时</div>
                    <div class="clock-time"></div>
                </div>
            </div>
            <div class="buttons">
                <button class="remove-button" title="删除此时钟">-</button>
            </div>
        `;
        this.container.appendChild(this.element);

        // 缓存 DOM 元素引用
        this.startTimeElement = this.element.querySelector('#startTime .clock-time');
        this.localTimeElement = this.element.querySelector('#localTime .clock-time');
        this.countdownElement = this.element.querySelector('#countdown .clock-time');
        this.statusElement = this.element.querySelector('#localTime .status');
        this.projectNameElement = this.element.querySelector('.project-name');
        this.countdownTitle = this.element.querySelector('#countdown .clock-title');
        this.removeButton = this.element.querySelector('.remove-button');

        // 新增引用
        this.projectEditIcon = this.element.querySelector('.project-edit-icon');
        this.timeEditIcon = this.element.querySelector('.time-edit-icon');
        this.startTimeTitle = this.element.querySelector('#startTime .clock-title');

        // 绑定事件
        this.startTimeElement.addEventListener('click', () => this.setStartTime());
        this.projectNameElement.addEventListener('blur', () => this.saveSettings());
        this.projectNameElement.addEventListener('keydown', (e) => {
            // 按 Enter 键时失去焦点
            if (e.key === 'Enter') {
                e.preventDefault();
                this.projectNameElement.blur();
            }
        });
        this.removeButton.addEventListener('click', () => this.removeClock());

        // 新增事件绑定
        if (this.projectEditIcon) {
            this.projectEditIcon.addEventListener('click', () => {
                this.projectNameElement.focus();
                // 尝试将光标移到末尾 (简单的 focus 在某些浏览器可能全选或在开始)
            });
        }

        if (this.timeEditIcon) {
            this.timeEditIcon.addEventListener('click', () => this.setStartTime());
        }

        if (this.startTimeTitle) {
            this.startTimeTitle.addEventListener('click', () => this.setStartTime());
        }
    }

    loadSettings() {
        const settings = safeJSONParse(localStorage.getItem(`clock-${this.index}`));

        // 设置开播时间
        if (settings.startTime) {
            const savedTime = new Date(settings.startTime);
            if (!isNaN(savedTime.getTime())) {
                this.startTime = savedTime;
            }
        }

        // 如果没有有效的开播时间，设置默认值（今天 23:59:59）
        if (!this.startTime || isNaN(this.startTime.getTime())) {
            this.startTime = new Date();
            this.startTime.setHours(23, 59, 59, 0);
        }

        // 如果开播时间已过，自动调整到明天同一时间
        this.adjustStartTimeIfPassed();

        // 设置项目名称
        this.projectNameElement.textContent = settings.projectName || `项目 ${this.index + 1}`;
    }

    /**
     * 如果开播时间已过超过1小时，自动调整到明天
     */
    adjustStartTimeIfPassed() {
        const now = new Date();
        const timeDiff = this.startTime - now;
        // 如果已过去超过1小时，调整到明天
        if (timeDiff < -3600000) {
            this.startTime.setDate(this.startTime.getDate() + 1);
            this.saveSettings();
        }
    }

    saveSettings() {
        if (!this.startTime || isNaN(this.startTime.getTime())) return;

        const projectName = this.projectNameElement.textContent.trim() || `项目 ${this.index + 1}`;
        this.projectNameElement.textContent = projectName;

        localStorage.setItem(`clock-${this.index}`, JSON.stringify({
            startTime: this.startTime.toISOString(),
            projectName: projectName
        }));
    }

    setStartTime() {
        // 使 Prompt 在下一个事件循环中执行，防止被立即关闭
        setTimeout(() => {
            // 暂停更新以防止干扰
            if (updateInterval) clearInterval(updateInterval);

            const currentTimeStr = this.formatTime(this.startTime);
            const newTime = prompt('请输入新的开播时间 (HH:MM:SS):', currentTimeStr);

            // 恢复更新
            updateAllClocks(); // 立即更新一次
            updateInterval = setInterval(updateAllClocks, 1000);

            if (newTime === null) return; // 用户取消

            const trimmedTime = newTime.trim();
            if (!trimmedTime) return; // 空输入

            const parsed = parseTimeString(trimmedTime);
            if (!parsed) {
                alert('时间格式无效！支持格式如：14:30, 1430, 22 等');
                return;
            }

            const { hours, minutes, seconds } = parsed;
            const newStartTime = new Date();
            newStartTime.setHours(hours, minutes, seconds, 0);

            // 如果设置的时间已经过了，自动设置为明天
            if (newStartTime <= new Date()) {
                newStartTime.setDate(newStartTime.getDate() + 1);
            }

            this.startTime = newStartTime;
            this.saveSettings();
        }, 10);
    }

    updateClock() {
        if (!this.startTime || isNaN(this.startTime.getTime())) return;

        const now = new Date();
        const timeDiff = this.startTime - now;

        this.startTimeElement.textContent = this.formatTime(this.startTime);
        this.localTimeElement.textContent = this.formatTime(now);

        if (timeDiff > 0) {
            // 倒计时中
            this.countdownElement.textContent = this.formatTimeDiff(timeDiff);

            if (timeDiff <= 10000) {
                // 10秒或更少 - 红色闪烁
                this.countdownElement.style.color = COLORS.red;
                this.countdownElement.style.textShadow = 'var(--glow-red)';
                this.countdownElement.style.animation = 'blink 1s infinite';
            } else if (timeDiff <= 600000) {
                // 10分钟或更少 - 橙色
                this.countdownElement.style.color = COLORS.orange;
                this.countdownElement.style.textShadow = 'var(--glow-orange)';
                this.countdownElement.style.animation = 'none';
            } else {
                // 正常 - 绿色
                this.countdownElement.style.color = COLORS.green;
                this.countdownElement.style.textShadow = 'var(--glow-green)';
                this.countdownElement.style.animation = 'none';
            }

            this.statusElement.textContent = timeDiff <= 600000 ? '◎Standby' : '';
            this.statusElement.className = timeDiff <= 600000 ? 'standby' : 'status';
            this.countdownTitle.textContent = '倒计时';
        } else {
            // 直播中
            this.countdownElement.textContent = this.formatTimeDiff(-timeDiff);
            this.countdownElement.style.color = COLORS.red;
            this.countdownElement.style.textShadow = 'var(--glow-red)';
            this.countdownElement.style.animation = 'none';
            this.statusElement.textContent = '◉ONAIR';
            this.statusElement.className = 'on-air';
            this.countdownTitle.textContent = '直播中';
        }
    }

    formatTime(date) {
        if (!date || isNaN(date.getTime())) return '--:--:--';
        return date.toTimeString().slice(0, 8);
    }

    formatTimeDiff(diff) {
        if (diff < 0) diff = 0;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    removeClock() {
        if (typeof this.onRemove === 'function') {
            this.onRemove(this);
        }
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        localStorage.removeItem(`clock-${this.index}`);
    }
}

// ===== 应用主逻辑 =====

// 移除 DOMContentLoaded 包装，直接在脚本加载时执行（脚本位于 body底部）
// document.addEventListener('DOMContentLoaded', () => {
console.log("Script loaded");

// DOM 元素引用
const clocksContainer = document.getElementById('clocksContainer');
const addClockButton = document.getElementById('addClockButton');
const resetButton = document.getElementById('resetButton');
const loadingScreen = document.getElementById('loadingScreen');
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const saveSettingsButton = document.getElementById('saveSettings');
const backgroundOverlay = document.getElementById('backgroundOverlay');

// 应用状态
let clocks = [];
let tempSettings = {};
let nextClockIndex = 0; // 用于生成唯一的时钟索引
let updateInterval = null;

// ===== 时钟管理 =====

function generateClockIndex() {
    return nextClockIndex++;
}

function addClock() {
    const index = generateClockIndex();
    const newClock = new StudioClock(clocksContainer, index, handleClockRemove);
    clocks.push(newClock);
    // 立即保存新时钟的初始数据，确保刷新后不丢失
    newClock.saveSettings();
    saveClockIndices();
    updateRemoveButtonsVisibility();
    // 应用当前设置到新时钟（包括字体大小）
    loadSettings();
}

function handleClockRemove(clock) {
    // 延迟执行以防止弹窗闪退
    setTimeout(() => {
        // 阻止删除最后一个时钟
        if (clocks.length <= 1) {
            alert('至少需要保留一个时钟');
            return;
        }

        // 从数组中移除
        const idx = clocks.indexOf(clock);
        if (idx > -1) {
            clocks.splice(idx, 1);
        }

        // 销毁时钟
        clock.destroy();
        saveClockIndices();
        updateRemoveButtonsVisibility();
    }, 10);
}

function updateRemoveButtonsVisibility() {
    // 如果只有一个时钟，隐藏删除按钮
    const singleClock = clocks.length <= 1;
    clocks.forEach(clock => {
        if (clock.removeButton) {
            clock.removeButton.style.display = singleClock ? 'none' : '';
        }
    });
}

function saveClockIndices() {
    // 保存当前的时钟索引列表和下一个索引
    const indices = clocks.map(c => c.index);
    localStorage.setItem('clockIndices', JSON.stringify(indices));
    localStorage.setItem('nextClockIndex', String(nextClockIndex));
}

function loadClocks() {
    return new Promise((resolve) => {
        console.log("Loading clocks");

        // 尝试加载索引列表（新格式）
        const savedIndices = safeJSONParse(localStorage.getItem('clockIndices'), null);
        const savedNextIndex = parseInt(localStorage.getItem('nextClockIndex'), 10);

        if (savedIndices && Array.isArray(savedIndices) && savedIndices.length > 0) {
            // 使用新格式加载
            nextClockIndex = isNaN(savedNextIndex) ? Math.max(...savedIndices) + 1 : savedNextIndex;
            savedIndices.forEach(index => {
                if (localStorage.getItem(`clock-${index}`)) {
                    const newClock = new StudioClock(clocksContainer, index, handleClockRemove);
                    clocks.push(newClock);
                }
            });
        } else {
            // 兼容旧格式：按顺序索引加载
            let index = 0;
            while (localStorage.getItem(`clock-${index}`)) {
                const newClock = new StudioClock(clocksContainer, index, handleClockRemove);
                clocks.push(newClock);
                index++;
            }
            nextClockIndex = index;
        }

        // 如果没有时钟，创建一个默认的
        if (clocks.length === 0) {
            addClock();
        }

        updateRemoveButtonsVisibility();
        console.log("Clocks loaded:", clocks.length);
        resolve();
    });
}

function resetClocks() {
    // 延迟执行以防止弹窗闪退
    setTimeout(() => {
        // 暂停更新
        if (updateInterval) clearInterval(updateInterval);

        if (!confirm('确定要重置所有时钟吗？这将删除所有保存的设置。')) {
            // 恢复更新
            updateInterval = setInterval(updateAllClocks, 1000);
            return;
        }

        // 清除 updateInterval (已清除)

        // 清除 localStorage
        localStorage.clear();

        // 清空容器和状态
        clocksContainer.innerHTML = '';
        clocks = [];
        nextClockIndex = 0;

        // 重新初始化
        addClock();
        loadSettings();

        // 重启更新定时器
        updateInterval = setInterval(updateAllClocks, 1000);
    }, 10);
}

function updateAllClocks() {
    clocks.forEach(clock => clock.updateClock());
}

// ===== UI 控制 =====

function hideLoadingScreen() {
    console.log("Hiding loading screen");
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
}

function toggleSettingsPanel() {
    if (!settingsPanel) return;

    const isHidden = settingsPanel.style.display === 'none' || !settingsPanel.style.display;
    if (isHidden) {
        settingsPanel.style.display = 'block';
        loadTempSettings();
    } else {
        settingsPanel.style.display = 'none';
        discardTempSettings();
    }
}

// ===== 设置管理 =====

function loadTempSettings() {
    const settings = safeJSONParse(localStorage.getItem('clockSettings'));
    tempSettings = { ...settings };

    const fontSizeEl = document.getElementById('fontSize');
    const backgroundModeEl = document.getElementById('backgroundMode');
    const blurAmountEl = document.getElementById('blurAmount');
    const opacityEl = document.getElementById('opacity');
    const glowEffectEl = document.getElementById('glowEffect');
    const darkModeEl = document.getElementById('darkMode');

    if (fontSizeEl) fontSizeEl.value = settings.fontSize || 70;
    if (backgroundModeEl) backgroundModeEl.value = settings.backgroundMode || 'cover';
    if (blurAmountEl) blurAmountEl.value = settings.blurAmount || 0;
    if (opacityEl) opacityEl.value = settings.opacity || 0;
    if (glowEffectEl) glowEffectEl.checked = settings.glowEffect !== false; // 默认开启
    if (darkModeEl) darkModeEl.checked = settings.darkMode === true; // 默认关闭

    updateBackgroundImageStatus(settings);
}

function handleBackgroundUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }

    // 限制文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
        alert('图片文件过大，请选择小于 5MB 的图片');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        tempSettings.backgroundImage = e.target.result;
        tempSettings.backgroundImageName = file.name;
        updateBackgroundImageStatus(tempSettings);
        previewSettings();
    };
    reader.onerror = function () {
        alert('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
}

function handleRemoveBackground() {
    tempSettings.backgroundImage = '';
    tempSettings.backgroundImageName = '';

    // 清空文件输入框
    const fileInput = document.getElementById('backgroundImage');
    if (fileInput) fileInput.value = '';

    updateBackgroundImageStatus(tempSettings);
    previewSettings();
}

function discardTempSettings() {
    tempSettings = {};
    loadSettings();
}

function saveSettingsHandler() {
    localStorage.setItem('clockSettings', JSON.stringify(tempSettings));
    applySettings(tempSettings);
    toggleSettingsPanel();
}

function applySettings(settings) {
    if (!settings) settings = {};

    // 应用字体大小
    const fontSize = settings.fontSize || 70;
    document.querySelectorAll('.clock-time').forEach(el => {
        el.style.fontSize = `${fontSize}px`;
    });

    // 应用背景图片
    if (settings.backgroundImage) {
        document.body.style.backgroundImage = `url('${settings.backgroundImage}')`;
    } else {
        document.body.style.backgroundImage = '';
    }

    // 应用背景模式
    const backgroundMode = settings.backgroundMode || 'cover';
    document.body.style.backgroundSize = backgroundMode === 'stretch' ? '100% 100%' : backgroundMode;

    // 应用模糊效果
    // 应用模糊效果和暗度（通过 CSS 变量控制 body::after 伪元素）
    const blurAmount = settings.blurAmount || 0;
    const opacity = settings.opacity || 0;

    document.body.style.setProperty('--blur-amount', `${blurAmount}px`);
    document.body.style.setProperty('--overlay-color', `rgba(0, 0, 0, ${opacity / 100})`);

    // 移除旧的直接样式，防止影响 position: fixed
    document.body.style.backdropFilter = '';

    // 应用发光效果设置
    if (settings.glowEffect === false) {
        document.body.classList.add('no-glow');
    } else {
        document.body.classList.remove('no-glow');
    }

    // 应用演播室深色模式
    if (settings.darkMode === true) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    adjustSettingsPanelStyle();
    updateBackgroundImageStatus(settings);
}

function updateBackgroundImageStatus(settings) {
    const currentBackgroundImage = document.getElementById('currentBackgroundImage');
    const removeButton = document.getElementById('removeBackgroundImage');

    if (!currentBackgroundImage) return;

    if (settings && settings.backgroundImageName) {
        currentBackgroundImage.textContent = `当前图片: ${settings.backgroundImageName}`;
        if (removeButton) removeButton.style.display = 'inline-block';
    } else {
        currentBackgroundImage.textContent = '未选择图片';
        if (removeButton) removeButton.style.display = 'none';
    }
}

function adjustSettingsPanelStyle() {
    if (!settingsPanel) return;

    const brightness = getBackgroundBrightness();
    if (brightness > 128) {
        settingsPanel.classList.add('light-bg');
    } else {
        settingsPanel.classList.remove('light-bg');
    }
}

function getBackgroundBrightness() {
    const bodyStyles = window.getComputedStyle(document.body);
    const bgImage = bodyStyles.backgroundImage;

    if (bgImage && bgImage !== 'none') {
        return 0; // 有背景图片时假设较暗
    }

    const bgColor = bodyStyles.backgroundColor;
    const rgb = bgColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
        return (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    }

    return 0;
}

function loadSettings() {
    const settings = safeJSONParse(localStorage.getItem('clockSettings'));
    applySettings(settings);
}

function previewSettings() {
    const fontSizeEl = document.getElementById('fontSize');
    const backgroundModeEl = document.getElementById('backgroundMode');
    const blurAmountEl = document.getElementById('blurAmount');
    const opacityEl = document.getElementById('opacity');
    const glowEffectEl = document.getElementById('glowEffect');
    const darkModeEl = document.getElementById('darkMode');

    tempSettings = {
        ...tempSettings,
        fontSize: fontSizeEl ? fontSizeEl.value : 70,
        backgroundMode: backgroundModeEl ? backgroundModeEl.value : 'cover',
        blurAmount: blurAmountEl ? blurAmountEl.value : 0,
        opacity: opacityEl ? opacityEl.value : 0,
        glowEffect: glowEffectEl ? glowEffectEl.checked : true,
        darkMode: darkModeEl ? darkModeEl.checked : false
    };

    applySettings(tempSettings);
}

// ===== 初始化 =====

function initializeApp() {
    console.log("Initializing app");

    if (!clocksContainer) {
        console.error("Clocks container not found");
        hideLoadingScreen();
        return;
    }

    // 确保设置面板初始状态为隐藏
    if (settingsPanel) {
        settingsPanel.style.display = 'none';
    }

    loadClocks()
        .then(() => {
            console.log("Clocks loaded");
            updateAllClocks();
            updateInterval = setInterval(updateAllClocks, 1000);
            loadSettings();
            adjustSettingsPanelStyle();
            hideLoadingScreen();
        })
        .catch(error => {
            console.error("Error during initialization:", error);
            hideLoadingScreen();
        });
}

// ===== 事件绑定 =====

if (addClockButton) {
    addClockButton.addEventListener('click', addClock);
}

if (resetButton) {
    resetButton.addEventListener('click', resetClocks);
}

if (settingsButton) {
    settingsButton.addEventListener('click', toggleSettingsPanel);
}

if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', saveSettingsHandler);
}

const backgroundImageInput = document.getElementById('backgroundImage');
if (backgroundImageInput) {
    backgroundImageInput.addEventListener('change', handleBackgroundUpload);
}

// 绑定移除背景按钮事件
const removeBackgroundButton = document.getElementById('removeBackgroundImage');
if (removeBackgroundButton) {
    removeBackgroundButton.addEventListener('click', handleRemoveBackground);
}

// 实时预览设置
['fontSize', 'backgroundMode', 'blurAmount', 'opacity'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', previewSettings);
    }
});

// 开关类设置的实时预览
['glowEffect', 'darkMode'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('change', previewSettings);
    }
});

// 点击设置面板外部关闭设置
document.addEventListener('click', function (event) {
    if (!settingsPanel || !settingsButton) return;

    const isClickInside = settingsPanel.contains(event.target) || event.target === settingsButton;
    if (!isClickInside && settingsPanel.style.display === 'block') {
        toggleSettingsPanel();
    }
});

// 键盘快捷键
// 键盘快捷键
document.addEventListener('keydown', function (event) {
    const isTyping = event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable;

    // ESC 关闭设置面板
    if (event.key === 'Escape') {
        if (settingsPanel && settingsPanel.style.display === 'block') {
            toggleSettingsPanel();
        }
    }

    // F 键切换全屏
    if ((event.key === 'f' || event.key === 'F') && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleFullScreen();
    }
});

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            document.body.classList.add('fullscreen-mode');
        }).catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// 监听全屏状态变化（处理ESC退出等情况）
document.addEventListener('fullscreenchange', function () {
    if (document.fullscreenElement) {
        document.body.classList.add('fullscreen-mode');
    } else {
        document.body.classList.remove('fullscreen-mode');
    }
});

// 启动应用
initializeApp();
// });
