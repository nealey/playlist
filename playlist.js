var base = ".";

function loadTrack(e) {
  let li = e.srcElement;
  let audio = document.querySelector("#audio");
  audio.src = base + "/" + li.textContent;
  audio.load();
  
  // Update "current"
  for (let cur of document.querySelectorAll(".current")) {
    cur.classList.remove("current");
  }
  li.classList.add("current");
}

function clickOn(element) {
  let e = new MouseEvent("click", {
    view: window,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(e);
}

function prev() {
  let cur = document.querySelector(".current");
  let prev = cur.previousElementSibling;
  if (prev) {
    cur = prev;
  }
  clickOn(cur);
}

function next() {
  let cur = document.querySelector(".current");
  let next = cur.nextElementSibling;
  if (next) {
    cur = next;
  }
  clickOn(cur);
}

function ended() {
  next();
}

function mmss(s) {
  let mm = Math.floor(s / 60);
  let ss = Math.floor(s % 60);
  
  if (ss < 10) {
    ss = "0" + ss;
  }
  return mm + ":" + ss;
}

function timeupdate(e) {
  let currentTime = e.srcElement.currentTime;
  let duration = e.srcElement.duration;
  let tgt = document.querySelector("#currentTime");
  
  document.querySelector("#currentTime").textContent = mmss(currentTime);
  if (duration - currentTime < 20) {
    tgt.classList.add("fin");
  } else {
    tgt.classList.remove("fin");
  }
}

function keydown(e) {
  let audio = document.querySelector("#audio");

  switch (event.key) {
    case " ": // space bar
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
      break;
      
    case "ArrowDown": // Next track
      next();
      break;
      
    case "ArrowUp": // Previous track
      prev();
      break;
  }
}

function midiMessage(e) {
  let audio = document.querySelector("#audio");
  let data = e.data;
  let ctrl = data[1];
  let val = data[2];
  if (data[0] == 176) {
    switch (ctrl) {
      case 0: // master volume slider
        audio.volume = val / 127;
        break;
      case 41: // play button
        if (val == 127) {
          audio.play();
        }
        break;
      case 42: // stop button
        if (val == 127) {
          audio.pause();
        }
        break;
      case 58: // prev button
        if (val == 127) {
          prev();
        }
        break;
      case 59: // next button
        if (val == 127) {
          next();
        }
        break;
    }
  }
}

function handleMidiAccess(access) {
  for (let input of access.inputs.values()) {
    input.addEventListener("midimessage", midiMessage);
  }
}

function run() {
  let audio = document.querySelector("#audio");
  
  // Set up events:
  // - Prev/Next buttons
  // - ended / timeupdate events on audio
  // - Track items
  document.querySelector("#prev").addEventListener("click", prev);
  document.querySelector("#next").addEventListener("click", next);
  audio.addEventListener("ended", ended);
  audio.addEventListener("timeupdate", timeupdate);
  for (let li of document.querySelectorAll("#playlist li")) {
    li.addEventListener("click", loadTrack);
  }
  
  // Bind keypress events
  // - space: play/pause
  //
  document.addEventListener("keydown", keydown);
  
  // Load up first track
  document.querySelector("#playlist li").classList.add("current");
  prev();
  
  navigator.requestMIDIAccess().then(handleMidiAccess);
}

window.addEventListener("load", run);
