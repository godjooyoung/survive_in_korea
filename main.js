// 게임 상태 관리
let gameState = {
	timeLimit: 0, // 초 단위
	timeRemaining: 0,
	timerInterval: null,
	currentEpisode : "ep1",
	currentChoosenCnt : 0,
	currentReadTextCnt : 0,

	/* 통계값 */
  readTextCnt: 0,          // 누적 읽은 활자수 (episode.totalCnt 누적)
  choiceMomentCnt: 0,      // choice 에피소드 진입 횟수
  choiceOptionCnt: 0,      // 누적 선택지 수(choices.length 누적)
};

let STORY = null;

const endEpId   = "ep_end";
const clearEpId = "ep_clear";

const gameTitle = document.querySelector('.game_title');
const imageWrap = document.querySelector('.game_image_wrap');
const storyWrap = document.querySelector('.game_story_wrap');
const storyArea = document.querySelector('.story_area');
const buttonWrap = document.querySelector('.button_wrap');
const startBtn = document.querySelector('#game_start_btn');
const statusBar = document.querySelector('.status_bar');


let bgmPlayer = new Audio();
bgmPlayer.loop = true;

let sfxPlayer = new Audio();
sfxPlayer.loop = false;


// 스토리 데이터 패치 후 자바스크립트 객체로 변환해서 반환
async function loadStory() {
	const res = await fetch("/data/story.json", { cache: "no-store" });
	if (!res.ok) throw new Error("story.json load failed");
	STORY = await res.json();
}

// 상태바
function updateStatusBar() {
	const percent = (gameState.timeRemaining / gameState.timeLimit) * 100;
	statusBar.style.width = percent + '%';
}


// 배경음 재생
function playBGM(src) {
	if (bgmPlayer.src.includes(src)) return;
	bgmPlayer.src = src;
	bgmPlayer.volume = 0.5;
	bgmPlayer.play().catch(() => { });
}


// 효과음 재생
function playSFX(src) {
	if (!src) {
		// 새 sfx 없으면 기존 소리 정지
		sfxPlayer.pause();
		sfxPlayer.currentTime = 0;
		return;
	}

	sfxPlayer.src = src;
	sfxPlayer.volume = 0.4;
	sfxPlayer.play().catch(() => { });
}

// 배경 이미지 처리 함수 
function updateSceneImage(imgPath) {
	if (imgPath) {
		imageWrap.style.backgroundImage = `url(${imgPath})`;
		imageWrap.style.backgroundColor = 'transparent';
	} else {
		imageWrap.style.backgroundImage = 'none';
		imageWrap.style.backgroundColor = '#0A0D13'; // 기본 단색
	}
}


// 타이핑 함수
function typeWriterEffect(element, htmlText, speed = 30, callback) {
	let i = 0;
	let text = htmlText.replace(/<br\s*\/?>/gi, "\n"); // 줄바꿈 처리
	element.innerHTML = "";

	function type() {
		if (i < text.length) {
			if (text[i] == "\n") {
				element.innerHTML += "<br/>";
			} else {
				element.innerHTML += text[i];
			}
			i++;
			setTimeout(type, speed);
		} else if (callback) {
			callback();
		}
	}

	type();
}

// 생존시간 함수
function startLifeTimer() {
	const min = 3 * 60;
	const max = 5 * 60;
	gameState.timeLimit = Math.floor(Math.random() * (max - min + 1)) + min;
	gameState.timeRemaining = gameState.timeLimit;

	updateStatusBar(); // 시작 시 100%

	gameState.timerInterval = setInterval(() => {
		gameState.timeRemaining--;

		updateStatusBar();

		if (gameState.timeRemaining <= 0) {
			clearInterval(gameState.timerInterval);
			goToEpisode('ep_end');
		}
	}, 1000);
}


// 통계 데이터를 위한 전역 상태 업데이트 하는 함수
function applyEpisodeStats(ep) {
	console.log('에피소드 마지막 다음 버튼 클릭, applyEpisodeStats 진입, 통계 기록 ')
	let epType 				 = ep.type;
	let epTextTotalCnt = ep.totalCnt; 

	// 1) 읽은 글자 수 누적
	// 있을때 처리, 없거나 null이거나 undefiend 일땐 0으로 간주하고 더하지 않음. 0도 풀리쉬 값이므로 여기 해당 안됨
	if(epTextTotalCnt){
		if(typeof epTextTotalCnt == "string") {
			epTextTotalCnt = Number(epTextTotalCnt);
		}
		gameState.readTextCnt += epTextTotalCnt
	}

	// 2) 마주했던 선택 순간 횟수 누적
	if(epType == "choice"){
		gameState.choiceMomentCnt += 1;

		if (Array.isArray(ep.choices)) {
      gameState.choiceOptionCnt += ep.choices.length;
    }
	}

	console.log('::::: 통계 값 ::::::')
	console.log(gameState)

}



/**
 * 게임 흐름 관련 함수
 */

// 선택지 랜더링
function renderChoices(choices) {
	buttonWrap.innerHTML = '';

	const wrap = document.createElement('div');
	wrap.className = 'choice_wrap';

	let locked = false; // 한 번 선택하면 잠금


	choices.forEach(choice => {
		const btn = document.createElement('div');
		btn.className = 'g_button';
		btn.innerText = choice.text;
		/* 선택지 버튼 이벤트 바인딩 */
		btn.onclick = () => {
			if (locked) return;
      locked = true;

			// 선택한 버튼 색 변경된 거 보여주고,
			// 나머지 선택 안된건 기존 색 유지, 즉 클릭된 애만 특정 css 클랙스명 추가해서 서택된 걸 사용자로 하여금 알도록 처리
			// 1초 내지는 0.5초뒤에 다음 애피소드 이동 함수 

			btn.classList.add("is_selected");
			setTimeout(() => {
        goToEpisode(choice.next);
      }, 400);

		};
		wrap.appendChild(btn);
	});

	buttonWrap.appendChild(wrap);
}

// 텍스트 다음 라인 진행
function nextLine(node, index) {
	const nextIndex = index + 1;

	if (nextIndex < node.prompts.length) {
		renderPrompt(node, nextIndex);
	} else {
		goToEpisode(node.next);
	}
}

// 프롬프트 랜더링 함수
function renderPrompt(node, index) {
	const prompt = node.prompts[index];

	if (!prompt) return;

	// 이미지 처리
	if (prompt.img) {
		updateSceneImage(prompt.img);
	} else {
		updateSceneImage();
	}

	// 효과음 재생
	playSFX(prompt.sfx);


	storyArea.innerHTML = '';
	buttonWrap.innerHTML = ''; // 버튼 영역 항상 초기화

	const bubble = document.createElement('div');
	bubble.className = `story_bubble ${prompt.type}`;
	storyArea.appendChild(bubble);

	// 데이터 타입이 라인일때 마지막 프롬프트까지 도달하면 다음 버튼 생성 하기 위한 내부 함수
	function showNextButton() {
		const btn = document.createElement('div');
		btn.className = 'g_button';
		btn.innerText = '다음';
		btn.onclick = () => nextLine(node, index);
		buttonWrap.appendChild(btn);
	}

	const isLastPrompt = index == node.prompts.length - 1;

	function afterTextRender() {
		if (node.type == 'lines') {
			showNextButton();
		}

		if (node.type == 'choice' && isLastPrompt) {
			renderChoices(node.choices);
		}

		// 타입이 그냥 줄글이든, 선택이든 마지막 프롬프트에 도달한 시점에 
		// 통계 데이터 업데이트
		if(isLastPrompt){
			applyEpisodeStats(node);
		}
	}

	// 텍스트 출력
	if (prompt.type == "normal_msg") {
		typeWriterEffect(bubble, prompt.text, 25, afterTextRender);
	} else {
		bubble.innerHTML = prompt.text;
		afterTextRender();
	}

}

// 에피소드 랜더링 함수
function renderEpisode(epId) {
	console.log("renderEpisode 진입")
	let node = STORY.nodes[epId];
	if (!node) {
		node =  STORY.nodes[clearEpId];
	}

	storyArea.innerHTML = '';
	buttonWrap.innerHTML = '';

	// BGM 변경
	if (node.bgm) {
		playBGM(node.bgm);
	}

	// 첫 프롬프트 출력
	renderPrompt(node, 0);
}

// 에피소드 이동 함수
function goToEpisode(epId) {
	gameState.currentEpisode = epId;
	gameState.currentPromptIndex = 0;
	renderEpisode(epId);
}




// 게임 시작 버튼 클릭
startBtn.addEventListener('click', async () => {
	// 노필터 삭제하기
	imageWrap.classList.remove('no_filter');
	gameTitle.style.display = 'none';
	await loadStory();
	startLifeTimer();     // 생존 타이머 시작
	goToEpisode('ep1');   // 무조건 ep1 시작
});










