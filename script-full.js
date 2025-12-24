// ============================================
// ПОЛНАЯ ВЕРСИЯ С BACKEND
// Переименуйте в script.js после настройки backend
// ============================================

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ВАЖНО: Укажите URL вашего backend после деплоя
const BACKEND_URL = 'https://pro-montage-backend.vercel.app';

const appState = {
    mode: '',
    secondVideo: null,
    secondVideoUrl: null,
    avatarPosition: 'top',
    screenRatio: 50,
    faceScale: 50,
    addSubtitles: false,
    subtitleType: 'template',
    subtitleTemplate: 'minimal_clean',
    subtitlePosition: 'bottom',
    fontSize: 30
};

let currentScreen = 1;

// Navigation
function showScreen(screenNumber) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    const targetScreen = document.querySelector(`[data-screen="${screenNumber}"]`);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        currentScreen = screenNumber;
    }
    
    updateTelegramUI();
}

function goBack() {
    if (currentScreen > 1) {
        showScreen(currentScreen - 1);
    }
}

// Screen 1: Select mode
function selectMode(mode) {
    console.log('Mode selected:', mode);
    appState.mode = mode;
    
    const modeNames = {
        'split_screen': 'Раздерение экрана',
        'corner': 'В углу экрана',
        'video_insert': 'Видео-вставки'
    };
    
    document.getElementById('selected-mode-title').textContent = modeNames[mode];
    setTimeout(() => showScreen(2), 200);
}

// Screen 2: Upload video
function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('Video uploaded:', file.name, file.size);
    
    if (!file.type.startsWith('video/')) {
        tg.showAlert('Пожалуйста, выберите видео файл');
        return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
        tg.showAlert('Видео слишком большое (макс. 50 МБ)');
        return;
    }
    
    appState.secondVideo = file;
    
    const videoUrl = URL.createObjectURL(file);
    appState.secondVideoUrl = videoUrl;
    
    const previewContainer = document.getElementById('uploaded-preview');
    const videoElement = document.getElementById('preview-uploaded-video');
    
    videoElement.src = videoUrl;
    previewContainer.classList.remove('hidden');
    
    setTimeout(() => {
        showScreen(3);
        updateComposition();
    }, 1000);
}

// Screen 3: Settings & Composition
function updateComposition() {
    const video1 = document.getElementById('comp-video-1');
    const video2 = document.getElementById('comp-video-2');
    const position = appState.avatarPosition;
    const ratio = parseInt(appState.screenRatio);
    
    video1.style.cssText = '';
    video2.style.cssText = '';
    
    if (position === 'top') {
        video2.style.cssText = `top: 0; left: 0; right: 0; height: ${ratio}%;`;
        video1.style.cssText = `bottom: 0; left: 0; right: 0; height: ${100 - ratio}%;`;
    } else if (position === 'bottom') {
        video1.style.cssText = `top: 0; left: 0; right: 0; height: ${100 - ratio}%;`;
        video2.style.cssText = `bottom: 0; left: 0; right: 0; height: ${ratio}%;`;
    } else if (position === 'left') {
        video2.style.cssText = `top: 0; bottom: 0; left: 0; width: ${ratio}%;`;
        video1.style.cssText = `top: 0; bottom: 0; right: 0; width: ${100 - ratio}%;`;
    } else if (position === 'right') {
        video1.style.cssText = `top: 0; bottom: 0; left: 0; width: ${100 - ratio}%;`;
        video2.style.cssText = `top: 0; bottom: 0; right: 0; width: ${ratio}%;`;
    }
}

function toggleGroup(groupId) {
    const content = document.getElementById(groupId);
    const toggleIcon = document.getElementById(`toggle-${groupId}`);
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        toggleIcon.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        content.classList.add('collapsed');
        toggleIcon.classList.add('collapsed');
        toggleIcon.textContent = '▶';
    }
}

function updateSlider(type, value) {
    document.getElementById(`${type}-value`).textContent = value;
    
    if (type === 'screen') {
        appState.screenRatio = parseInt(value);
    } else if (type === 'scale') {
        appState.faceScale = parseInt(value);
    } else if (type === 'font') {
        appState.fontSize = parseInt(value);
    }
}

function updateState(key, value) {
    appState[key] = value;
}

function toggleSubtitles(checked) {
    appState.addSubtitles = checked;
    const subtitleGroup = document.getElementById('subtitle-group');
    if (checked) {
        subtitleGroup.classList.remove('hidden');
    } else {
        subtitleGroup.classList.add('hidden');
    }
}

function updateTelegramUI() {
    if (currentScreen > 1) {
        tg.BackButton.show();
        tg.BackButton.onClick(goBack);
    } else {
        tg.BackButton.hide();
    }
    
    if (currentScreen === 3) {
        tg.MainButton.setText('Запустить');
        tg.MainButton.color = '#4CAF50';
        tg.MainButton.textColor = '#FFFFFF';
        tg.MainButton.show();
        tg.MainButton.onClick(launchMontage);
    } else {
        tg.MainButton.hide();
    }
}

// Launch montage with backend
async function launchMontage() {
    console.log('Launching montage...');
    
    if (!appState.mode) {
        tg.showAlert('Выберите режим монтажа');
        return;
    }
    
    if (appState.mode === 'split_screen' && !appState.secondVideo) {
        tg.showAlert('Загрузите дополнительное видео');
        showScreen(2);
        return;
    }
    
    // Show processing screen
    showProcessingScreen();
    
    try {
        // Upload second video if exists
        let taskId = null;
        if (appState.secondVideo) {
            taskId = await uploadSecondVideo();
        }
        
        // Send settings to bot
        const dataToSend = {
            mode: appState.mode,
            taskId: taskId,
            avatar_position: appState.avatarPosition,
            screen_ratio: appState.screenRatio,
            face_scale: appState.faceScale,
            add_subtitles: appState.addSubtitles,
            subtitle_type: appState.subtitleType,
            subtitle_template: appState.subtitleTemplate,
            subtitle_position: appState.subtitlePosition,
            font_size: appState.fontSize
        };
        
        tg.sendData(JSON.stringify(dataToSend));
        
        // Poll for result
        if (taskId) {
            await pollTaskStatus(taskId);
        }
        
    } catch (error) {
        console.error('Error:', error);
        showErrorScreen(error.message);
    }
}

async function uploadSecondVideo() {
    updateProcessingStatus('Загрузка второго видео...', 20);
    
    const formData = new FormData();
    formData.append('video', appState.secondVideo);
    formData.append('userId', tg.initDataUnsafe.user.id);
    formData.append('settings', JSON.stringify(appState));
    
    const response = await fetch(`${BACKEND_URL}/api/upload-second-video`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Ошибка загрузки видео');
    }
    
    const result = await response.json();
    return result.taskId;
}

async function pollTaskStatus(taskId) {
    updateProcessingStatus('Обработка видео...', 40);
    
    const maxAttempts = 60; // 5 минут (60 * 5 секунд)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const response = await fetch(`${BACKEND_URL}/api/task-status/${taskId}`);
        const result = await response.json();
        
        if (result.status === 'completed') {
            showResultScreen(result.videoUrl);
            return;
        } else if (result.status === 'error') {
            throw new Error(result.error || 'Ошибка обработки');
        }
        
        // Update progress
        const progress = 40 + (attempts / maxAttempts) * 50;
        updateProcessingStatus('Обработка видео...', progress);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
    }
    
    throw new Error('Превышено время ожидания');
}

function showProcessingScreen() {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    
    // Show processing
    const processingHTML = `
        <div class="processing-screen">
            <div class="loader"></div>
            <h2 id="processing-title">Обработка...</h2>
            <div class="progress-bar">
                <div class="progress-fill" id="processing-progress"></div>
            </div>
            <p id="processing-percent">0%</p>
        </div>
    `;
    
    document.getElementById('app').innerHTML += processingHTML;
}

function updateProcessingStatus(title, percent) {
    document.getElementById('processing-title').textContent = title;
    document.getElementById('processing-progress').style.width = percent + '%';
    document.getElementById('processing-percent').textContent = Math.round(percent) + '%';
}

function showResultScreen(videoUrl) {
    const resultHTML = `
        <div class="result-screen">
            <div class="success-icon">✓</div>
            <h2>Готово!</h2>
            <video controls style="width: 100%; max-width: 400px; border-radius: 12px;">
                <source src="${videoUrl}" type="video/mp4">
            </video>
            <button class="download-btn" onclick="window.open('${videoUrl}', '_blank')">
                Скачать видео
            </button>
            <button class="close-btn" onclick="tg.close()">
                Закрыть
            </button>
        </div>
    `;
    
    document.getElementById('app').innerHTML = resultHTML;
}

function showErrorScreen(message) {
    const errorHTML = `
        <div class="error-screen">
            <div class="error-icon">❌</div>
            <h2>Ошибка</h2>
            <p>${message}</p>
            <button class="retry-btn" onclick="location.reload()">
                Попробовать снова
            </button>
        </div>
    `;
    
    document.getElementById('app').innerHTML = errorHTML;
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Mini App initialized (FULL VERSION)');
    showScreen(1);
    
    if (tg.colorScheme === 'dark') {
        document.body.style.background = 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)';
    }
});

console.log('=== PRO Montage v3.0 (Full) ===');
console.log('Backend URL:', BACKEND_URL);



