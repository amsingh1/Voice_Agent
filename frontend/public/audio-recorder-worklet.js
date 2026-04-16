// AudioWorklet processor for recording microphone input as PCM16 at the AudioContext sample rate.
// Buffers samples and posts Int16Array chunks to the main thread.

class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 2400; // 100ms at 24kHz
    this._isRecording = true;

    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this._isRecording = false;
      } else if (event.data.type === 'start') {
        this._isRecording = true;
      }
    };
  }

  process(inputs) {
    if (!this._isRecording) return true;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      this._buffer.push(channelData[i]);
    }

    while (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.splice(0, this._bufferSize);
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage({ type: 'audio', data: int16.buffer }, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderWorklet);
