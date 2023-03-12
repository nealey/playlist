let ctx = new AudioContext()

const Millisecond = 1
const Second = 1000 * Millisecond
const Minute = 60 * Second

class Track {
  constructor() {
    this.startedAt = 0
    this.pausedAt = 0
    console.log(this)
    window.track = this
  }

  async load(url) {
    this.filename = url.split("/").pop()
    let resp = await fetch(url)
    let buf = await resp.arrayBuffer()
    this.abuf = await ctx.decodeAudioData(buf)
  }

  Duration() {
    if (this.abuf) {
      return this.abuf.duration * Second
    }
    return 0
  }
}

class Playlist {
  constructor(base="./music") {
    this.base = base
    this.list = {}
    this.current = null
    this.startedAt = 0
    this.pausedAt = 0
  }

  async add(filename) {
    let track = new Track()
    this.list[filename] = track
    await track.load(`${this.base}/${filename}`)
    return track
  }

  async load(filename) {
    this.stop()
    this.current = this.list[filename]
    if (!this.current) {
      this.current = await this.add(filename)
    }
  }

  play(pos=null) {
    let offset = this.pausedAt / Second
    if (pos) {
      offset = this.current.abuf.duration * pos
    }
    if (this.startedAt) {
      this.stop()
    }
    console.log(offset)
    this.source = new AudioBufferSourceNode(ctx)
    this.source.buffer = this.current.abuf
    this.source.connect(ctx.destination)
    this.source.start(0, offset)
    this.startedAt = (ctx.currentTime - offset) * Second
    this.pausedAt = 0
  }

  pause() {
    let pos = this.CurrentTime()
    this.stop()
    this.pausedAt = pos
  }

  stop() {
    if (this.source) {
      this.source.disconnect()
      this.source.stop()
    }
    this.pausedAt = 0
    this.startedAt = 0
  }

  PlayPause() {
    console.log("Play/Pause")
    if (this.startedAt) {
      this.pause()
    } else {
      this.play()
    }
  }

  Seek(pos) {
    if (this.startedAt) {
      this.play(pos)
    } else {
      this.pausedAt = this.Duration() * pos
    }
  }

  CurrentTime() {
    if (this.startedAt) {
      return ctx.currentTime*Second - this.startedAt
    }
    if (this.pausedAt) {
      return this.pausedAt
    }
    return 0
  }

  Duration() {
    return this.current.Duration()
  }
}

let playlist = new Playlist()
window.playlist = playlist

async function loadTrack(e) {
  let li = e.target

  playlist.load(li.textContent)
  
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

function mmss(duration) {
  let mm = Math.floor(duration / Minute)
  let ss = Math.floor((duration / Second) % 60)
  
  if (ss < 10) {
    ss = "0" + ss
  }
  return mm + ":" + ss
}

function volumechange(e) {
  document.querySelector("#vol").value = e.target.volume
}


function timeupdate() {
  let currentTime = playlist.CurrentTime()
  let duration = playlist.Duration()
  let tgt = document.querySelector("#currentTime")
  let pos = document.querySelector("#pos")

  pos.value = currentTime / duration

  tgt.textContent = mmss(currentTime)
  if (duration - currentTime < 20 * Second) {
    tgt.classList.add("fin")
  } else {
    tgt.classList.remove("fin")
  }
}

function setPos(e) {
  let val = e.target.value
  playlist.Seek(val)
}

function setGain(e) {
  let val = e.target.value
  let audio = document.querySelector("#audio")
  
  audio.volume = val
}

function keydown(e) {
  let audio = document.querySelector("#audio")

  switch (e.key) {
    case " ": // space bar
      playlist.PlayPause()
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
  audio.addEventListener("volumechange", volumechange)
  for (let li of document.querySelectorAll("#playlist li")) {
    playlist.add(li.textContent)
    li.addEventListener("click", loadTrack)
  }

  setInterval(() => timeupdate(), 250 * Millisecond)
  
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
