// 게임 상태 관리
let gameStateObj = {
	timeLimit: 0, // 초 단위
	timeRemaining: 0,
	timerInterval: null,
	currentEpisode: "ep1",
	currentChoosenCnt: 0,
	currentReadTextCnt: 0,

	/* 통계값 */
	readTextCnt: 0,          // 누적 읽은 활자수 (episode.totalCnt 누적)
	choiceMomentCnt: 0,      // choice 에피소드 진입 횟수
	choiceOptionCnt: 0,      // 누적 선택지 수(choices.length 누적)

	/**종료, 클리어 노드 */
	endNodeId : "ep_end",
	clearNodeId : "ep_clear"
};

let STORY = null;

let bgmPlayer = new Audio();
bgmPlayer.loop = true;

let sfxPlayer = new Audio();
sfxPlayer.loop = false;

// 돔 요소
const gameTitle = document.querySelector('.game_title');
const imageWrap = document.querySelector('.game_image_wrap');
const storyWrap = document.querySelector('.game_story_wrap');
const storyArea = document.querySelector('.story_area');
const buttonWrap = document.querySelector('.button_wrap');
const startBtn = document.querySelector('#game_start_btn');
const statusBar = document.querySelector('.status_bar');


// 스토리 데이터 패치 후 자바스크립트 객체로 변환해서 반환
async function loadStory() {
	console.log('이야기를 가져옵니다.')
  const res = await fetch("/data/story.yaml", { cache: "no-store" });
  if (!res.ok) throw new Error("story.yaml load failed");

  const yamlText = await res.text();
  STORY = jsyaml.load(yamlText);
}

// 상태바
function updateStatusBar() {
	const percent = (gameStateObj.timeRemaining / gameStateObj.timeLimit) * 100;
	statusBar.style.width = percent + '%';
}

// 배경음 재생
function playBGM(src) {
	if (bgmPlayer.src.includes(src)) return;
	bgmPlayer.src = src;
	bgmPlayer.volume = 0.3;
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
	sfxPlayer.volume = 0.6;
	sfxPlayer.play().catch(() => { });
}

// 배경 이미지 처리 함수 
function updateSceneImage(pMsgObj) {
	// 연출 처리를 위한 이미지 패스 뿐 아니라, 연출 정보도 매개변수로 받음
	let imgPath   = pMsgObj.img_src;
	let imgEffect = pMsgObj.scn_fx;

	if (imgPath) {
		imageWrap.style.backgroundImage = `url(${imgPath})`;
		imageWrap.style.backgroundColor = 'transparent';
		if(imgEffect){
			imageWrap.classList.add(imgEffect);
		}
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
	gameStateObj.timeLimit = Math.floor(Math.random() * (max - min + 1)) + min;
	gameStateObj.timeRemaining = gameStateObj.timeLimit;

	updateStatusBar(); // 시작 시 100%

	gameStateObj.timerInterval = setInterval(() => {
		gameStateObj.timeRemaining--;

		updateStatusBar();

		if (gameStateObj.timeRemaining <= 0) {
			clearInterval(gameStateObj.timerInterval);
			runNode(gameStateObj.endNodeId);
		}
	}, 1000);
}


// 시간이 남아있더라도 이 함수가 실행되면 더이상 실시간으로 생존 시간을 계산하지 않고 계산 로직 자체를 멈춘다.
// 인터벌 객체 종료
function pauseLifeTimer() {
	if (!gameStateObj.timerInterval) return;
	clearInterval(gameStateObj.timerInterval);
	gameStateObj.timerInterval = null;
}



/**
 * 게임 흐름 관련 함수
 */


function nextLine(pNodeObj, pStartIdx) {
	// 마지막 인덱스가 아니라면 메세지 랜더
	// 마지막 인덱스라면 다음 노드 런
	
	const nodeObj		= pNodeObj;
		
	const startIdx	= pStartIdx ? pStartIdx : 0;
	const nextIdx 	= startIdx + 1;

	const msgList = nodeObj.msg_list;

	if (nextIdx < msgList.length) {
		renderMsg(nodeObj, nextIdx);
	} else {
		runNode(nodeObj.next_ids);
	}
}


function renderMsg(pNodeObj, pMsgIdx) {
	const nodeObj = pNodeObj;
	const msgIdx  = pMsgIdx;
	const msgList = pNodeObj.msg_list;

	const nodeId = nodeObj.node_id;
	const clearNodeId = gameStateObj.clearNodeId;
	const isClearNode = nodeId == clearNodeId ? true : false;

	const msgObj = msgList[msgIdx];

	const msgType = msgObj.msg_tp ? msgObj.msg_tp : '';
	const msgText = msgObj.msg_tx ? msgObj.msg_tx : '';
	const msgDelayMs = msgObj.dly_ms ? msgObj.dly_ms : 0;

	const isLastMsg = msgIdx == msgList.length - 1 ? true : false;

	if (!msgObj) {
		return;
	}

	// 돔 초기화
	storyArea.innerHTML = '';
	buttonWrap.innerHTML = ''; 
	
	// 돔 초기화 - 연출 제거
	imageWrap.classList.remove("shake", "shake__heavy");

	// 이미지 처리
	updateSceneImage(msgObj);

	setTimeout(() => {
		// 효과음 재생
		playSFX(msgObj.sfx_src);

		const bubble = document.createElement('div');
		bubble.className = `story_bubble ${msgType}`;

		// 버블 돔 요소 붙이기
		storyArea.appendChild(bubble);
		
		// 텍스트 출력 동작 부분
		switch (msgType) {
			case "normal_msg":
				typeWriterEffect(bubble, msgText, 25, ()=>{afterTextRender()});
				break;
			case "system_msg":
			case "effect_msg":
				bubble.innerHTML = msgText;
				afterTextRender();
				break;
			default:
				console.debug(`msg_type를 확인하세요. ${msgType}.`);
		}
	}, msgDelayMs);


	function afterTextRender() {

		// 데이터 타입이 선택지 일때 마지막 프롬프트까지 도달하면 선택지 랜더링 하기 위한 내부 함수
		function _showChoiceButton(choices) {
			buttonWrap.innerHTML = '';

			const wrap = document.createElement('div');
			wrap.className = 'choice_wrap';

			let locked = false; // 한 번 선택하면 잠금


			choices.forEach(choice => {
				const btn = document.createElement('div');
				btn.className = 'g_button';
				btn.innerText = choice.msg_tx;
				/* 선택지 버튼 이벤트 바인딩 */
				btn.onclick = () => {
					if (locked) return;
					locked = true;

					// 선택한 버튼 색 변경된 거 보여주고,
					// 나머지 선택 안된건 기존 색 유지, 즉 클릭된 애만 특정 css 클랙스명 추가해서 서택된 걸 사용자로 하여금 알도록 처리
					// 1초 내지는 0.5초뒤에 다음 애피소드 이동 함수 

					btn.classList.add("is_selected");
					setTimeout(() => {
						runNode(choice.next_ids);
					}, 400);

				};
				wrap.appendChild(btn);
			});

			buttonWrap.appendChild(wrap);
		}

		// 클리어나 종료시 보일 마지막 버튼
		function _showClearButtons() {
			buttonWrap.innerHTML = "";

			const wrap = document.createElement("div");
			wrap.className = "choice_wrap"; // 기존 스타일 재사용

			// 1) 처음으로
			const restartBtn = document.createElement("div");
			restartBtn.className = "g_button";
			restartBtn.innerText = "처음으로";
			restartBtn.onclick = () => {
				// TODO 저장 기능 완성 후
				// saveGame();  // 있으면 저장 먼저 하고
				window.location.reload();
			};

			// // 2) TODO 저장
			// const saveBtn = document.createElement("div");
			// saveBtn.className = "g_button";
			// saveBtn.innerText = "저장";
			// saveBtn.onclick = () => {
			// 	// 일단 훅만 걸어두기: 저장 로직은 나중에
			// 	// saveGame();
			// 	console.log("SAVE:", gameState);
			// };

			wrap.appendChild(restartBtn);
			// wrap.appendChild(saveBtn);
			buttonWrap.appendChild(wrap);
		}

		// 데이터 타입이 라인일때 마지막 프롬프트까지 도달하면 다음 버튼 생성 하기 위한 내부 함수
		function _showNextButton() {
			const btn = document.createElement('div');
			btn.className = 'g_button';
			btn.innerText = '다음';
			btn.onclick = () => nextLine(nodeObj, msgIdx);
			buttonWrap.appendChild(btn);
		
		}

		// 통계 데이터를 위한 전역 상태 업데이트 하는 함수
		function _applyPlayStats(pNodeObj) {
			const nodeObj = pNodeObj;
			let nodeType = nodeObj.node_tp;
			let nodeTextTotalCnt = nodeObj.txt_cnt;

			// 1) 읽은 글자 수 누적
			// 있을때 처리, 없거나 null이거나 undefiend 일땐 0으로 간주하고 더하지 않음. 0도 풀리쉬 값이므로 여기 해당 안됨
			if (nodeTextTotalCnt) {
				if (typeof nodeTextTotalCnt == "string") {
					nodeTextTotalCnt = Number(nodeTextTotalCnt);
				}
				gameStateObj.readTextCnt += nodeTextTotalCnt
			}

			// 2) 마주했던 선택 순간 횟수 누적
			if (nodeType == "choice") {
				gameStateObj.choiceMomentCnt += 1;

				if (Array.isArray(nodeObj.choices)) {
					gameStateObj.choiceOptionCnt += nodeObj.choices.length;
				}
			}
		}

		if(!isClearNode){
			if (nodeObj.node_tp == 'lines') {
				_showNextButton();
			}

			if (nodeObj.node_tp == 'choice' && isLastMsg) {
				_showChoiceButton(nodeObj.choices);
			}

			// 타입이 그냥 줄글이든, 선택이든 마지막 프롬프트에 도달한 시점에 
			// 통계 데이터 업데이트
			if (isLastMsg) {
				_applyPlayStats(nodeObj);
			}
		}else{
			_showClearButtons()
		}
		
	}

}

// 스토리 노드 실행
function runNode(pNodeIds) {
	const nodeIds = pNodeIds;
	let nodeId;

	if (!nodeIds || (Array.isArray(nodeIds) && nodeIds.length == 0)) {
		// 1) epIds가 없거나 빈 배열이면 → 클리어 루트
		nodeId = null;
	} else if (Array.isArray(nodeIds)) {
		// 2) 배열이면 랜덤 선택
		const randIndex = Math.floor(Math.random() * nodeIds.length);
		nodeId = nodeIds[randIndex];
	} else if (typeof pNodeIds == "string") {
		// 3) 문자열이면 그대로
		nodeId = nodeIds;
	} else {
		// 4) 그 외 타입은 방어
		nodeId = null;
	}

	gameStateObj.currentEpisode = nodeId;
	renderNode(nodeId);
}

// 스토리 노드 랜더링
function renderNode(nodeId) {
	let nodeObj = STORY.node_dict[nodeId];

	if (!nodeObj) {
		pauseLifeTimer();
		nodeObj = STORY.node_dict[gameStateObj.clearNodeId];
	}

	let nodeBgm = nodeObj.bgm_src ? nodeObj.bgm_src : null;

	storyArea.innerHTML = '';
	buttonWrap.innerHTML = '';

	// BGM 변경
	if (nodeBgm) {
		playBGM(nodeBgm);
	}

	renderMsg(nodeObj, 0);
}




// 게임 시작 버튼 클릭
startBtn.addEventListener('click', async () => {
	// TODO 로드 스토리 안될때 트라이 캐치로 예외걸기
	playBGM("/assets/audios/bgm/theme_008.mp3");

	// 노필터 삭제하기
	imageWrap.classList.remove('no_filter');
	gameTitle.style.display = 'none';
	await loadStory();
	startLifeTimer();     // 생존 타이머 시작
	runNode('ep1');   // 무조건 ep1 시작
});











