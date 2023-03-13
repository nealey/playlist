let ctx = new AudioContext()

const Millisecond = 1
const Second = 1000 * Millisecond
const Minute = 60 * Second

class Track {
  constructor() {
    this.startedAt = 0
    this.pausedAt = 0
    window.track = this
  }

  async Load(url) {
    this.filename = url.split("/").pop()
    let resp = await fetch(url)
    if (resp.ok) {
      let buf = await resp.arrayBuffer()
      this.abuf = await ctx.decodeAudioData(buf)
    } else {
      let options = {
        length: 1,
        sampleRate: 3000,
      }
      this.abuf = new AudioBuffer(options)
    }
  }

  Duration() {
    if (this.abuf) {
      return this.abuf.duration
    }
    return 0
  }
}

class Playlist {
  constructor(base="./music") {
    this.base = base
    this.list = {}
    this.current = null
    this.Stop()
  }

  /**
   * Preload a track
   * 
   * @param {String} filename 
   * @returns {Track}
   */
  async Add(filename) {
    let track = new Track()
    this.list[filename] = track
    await track.Load(`${this.base}/${filename}`)
    return track
  }

  /**
   * Load a track by filename
   * 
   * @param {String} filename 
   */
  async Load(filename) {
    this.Stop()
    this.current = this.list[filename]
    if (!this.current) {
      this.current = await this.add(filename)
    }
  }

  /**
   * Returns current position as a percentage (0.0-1.0)
   */
  Position() {
    let duration = this.Duration()
    let pos = 0
    if (!duration) {
      return 0
    }
    if (this.Playing()) {
      pos = ctx.currentTime - this.startedAt
      pos = Math.min(pos, duration)
    }
    return pos / duration
  }

  Play(pos=null) {
    let offset = this.pausedAt
    if (pos) {
      offset = this.current.abuf.duration * pos
    }
    this.Stop()
    this.source = new AudioBufferSourceNode(ctx)
    this.source.buffer = this.current.abuf
    this.source.connect(ctx.destination)
    this.source.start(0, offset)
    this.startedAt = ctx.currentTime - offset
  }

  Pause() {
    let pos = this.CurrentTime()
    this.Stop()
    this.pausedAt = pos
  }

  Stop() {
    if (this.source) {
      this.source.disconnect()
      this.source.stop()
    }
    this.pausedAt = 0
    this.startedAt = -1
  }

  Playing() {
    if (this.startedAt > -1) {
      let pos = ctx.currentTime - this.startedAt
      return pos < this.Duration()
    }
    return false
  }

  PlayPause() {
    if (this.Playing()) {
      this.Pause()
    } else {
      this.Play()
    }
  }

  Seek(pos) {
    if (this.Playing()) {
      this.Play(pos)
    } else {
      this.pausedAt = this.Duration() * pos
    }
  }

  CurrentTime() {
    if (this.Playing()) {
      return Math.min(ctx.currentTime - this.startedAt, this.Duration())
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

  playlist.Load(li.textContent)
  
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
  let currentTime = playlist.CurrentTime() * Second
  let duration = playlist.Duration() * Second
  let cur = document.querySelector("#currentTime")
  let remain = document.querySelector("#remainingTime")
  let pos = document.querySelector("#pos")

  pos.value = currentTime / duration

  cur.textContent = mmss(currentTime)
  if (duration - currentTime < 20 * Second) {
    cur.classList.add("fin")
  } else {
    cur.classList.remove("fin")
  }
  remain.textContent = mmss(duration - currentTime)
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
          playlist.Play()
        }
        break
      case 42: // stop button
        if (val == 127) {
          playlist.Pause()
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
    li.classList.add("loading")
    li.addEventListener("click", loadTrack)
    playlist.Add(li.textContent)
    .then(() => {
      li.classList.remove("loading")
    })
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
