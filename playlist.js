// jshint asi:true

// HTML5 Playlist by Neale Pickett
// https://github.com/nealey/playlst


var base = "."

function loadTrack(e) {
  let li = e.target
  let audio = document.querySelector("#audio")
  audio.src = base + "/" + li.textContent
  audio.load()
  
  // Update "current"
  for (let cur of document.querySelectorAll(".current")) {
    cur.classList.remove("current")
  }
  li.classList.add("current")
}

function clickOn(element) {
  let e = new MouseEvent("click", {
    view: window,
    bubbles: true,
    cancelable: true
  })
  element.dispatchEvent(e)
}

function prev() {
  let cur = document.querySelector(".current")
  let prev = cur.previousElementSibling
  if (prev) {
    cur = prev
  }
  clickOn(cur)
}

function next() {
  let cur = document.querySelector(".current")
  let next = cur.nextElementSibling
  if (next) {
    cur = next
  }
  clickOn(cur)
}

function ended() {
  next()
}

function mmss(s) {
  let mm = Math.floor(s / 60)
  let ss = Math.floor(s % 60)
  
  if (ss < 10) {
    ss = "0" + ss
  }
  return mm + ":" + ss
}

function durationchange(e) {
  let duration = e.target.duration
  
  document.querySelector("#duration").textContent = mmss(duration)
  timeupdate(e)
}

function volumechange(e) {
  document.querySelector("#vol").value = e.target.volume
}


function timeupdate(e) {
  let currentTime = e.target.currentTime
  let duration = e.target.duration || 1
  let tgt = document.querySelector("#currentTime")
  let pos = document.querySelector("#pos")

  pos.value = currentTime / duration

  tgt.textContent = mmss(currentTime)
  if (duration - currentTime < 20) {
    tgt.classList.add("fin")
  } else {
    tgt.classList.remove("fin")
  }
}

function setPos(e) {
  let val = e.target.value
  let audio = document.querySelector("#audio")

  audio.currentTime = audio.duration * val
}

function setGain(e) {
  let val = e.target.value
  let audio = document.querySelector("#audio")
  
  audio.volume = val
}

function keydown(e) {
  let audio = document.querySelector("#audio")

  switch (event.key) {
    case " ": // space bar
      if (audio.paused) {
        audio.play()
      } else {
        audio.pause()
      }
      break
      
    case "ArrowDown": // Next track
      next()
      break
      
    case "ArrowUp": // Previous track
      prev()
      break
  }
}

function midiMessage(e) {
  let audio = document.querySelector("#audio")
  let data = e.data
  let ctrl = data[1]
  let val = data[2]
  if ((data[0] == 0xb0) || (data[0] == 0xbf)) {
    switch (ctrl) {
      case 0: // master volume slider
        audio.volume = val / 127
        document.querySelector("#vol").value = audio.volume
        break
      case 41: // play button
        if (val == 127) {
          // The first time, the browser will reject this,
          // because it doesn't consider MIDI input user interaction,
          // so it looks like an autoplaying video.
          audio.play()
        }
        break
      case 42: // stop button
        if (val == 127) {
          audio.pause()
        }
        break
      case 58: // prev button
        if (val == 127) {
          prev()
        }
        break
      case 59: // next button
        if (val == 127) {
          next()
        }
        break
    }
  }
}

function handleMidiAccess(access) {
  for (let input of access.inputs.values()) {
    input.addEventListener("midimessage", midiMessage)
  }
  
  for (let output of access.outputs.values()) {
    if (output.name == "nanoKONTROL2 MIDI 1") {
      controller = output
      output.send([0xf0, 0x42, 0x40, 0x00, 0x01, 0x13, 0x00, 0x00, 0x00, 0x01, 0xf7]); // Native Mode (lets us control LEDs, requires sysex privilege)
      output.send([0xbf, 0x2a, 0x7f]); // Stop
      output.send([0xbf, 0x29, 0x7f]); // Play
    }
  }
}

function run() {
  let audio = document.querySelector("#audio")
  
  // Set up events:
  // - Prev/Next buttons
  // - ended / timeupdate events on audio
  // - Track items
  document.querySelector("#prev").addEventListener("click", prev)
  document.querySelector("#next").addEventListener("click", next)
  document.querySelector("#pos").addEventListener("input", setPos)
  document.querySelector("#vol").addEventListener("input", setGain)
  audio.addEventListener("ended", ended)
  audio.addEventListener("timeupdate", timeupdate)
  audio.addEventListener("durationchange", durationchange)
  audio.addEventListener("volumechange", volumechange)
  for (let li of document.querySelectorAll("#playlist li")) {
    li.addEventListener("click", loadTrack)
  }
  
  document.querySelector("#vol").value = audio.volume
  
  // Bind keypress events
  // - space: play/pause
  //
  document.addEventListener("keydown", keydown)
  
  // Load up first track
  document.querySelector("#playlist li").classList.add("current")
  prev()
  
  navigator.requestMIDIAccess({sysex: true}).then(handleMidiAccess)
}

window.addEventListener("load", run)
