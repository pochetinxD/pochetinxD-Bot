// Detección de plataforma y validación de URLs (sin red:
// descargarVideo() solo se prueba en vivo, no en npm test).
const assert = require('node:assert');
const { describe, it } = require('node:test');

const { detectarPlataforma, esUrlVideo, descargarVideo } = require('../src/descargas');

describe('descargas: detectarPlataforma', () => {
  it('reconoce YouTube (youtube.com y youtu.be)', () => {
    assert.equal(detectarPlataforma('https://www.youtube.com/watch?v=jNQXAC9IVRw').id, 'youtube');
    assert.equal(detectarPlataforma('https://youtu.be/jNQXAC9IVRw').id, 'youtube');
  });

  it('reconoce TikTok, Instagram y Facebook', () => {
    assert.equal(detectarPlataforma('https://www.tiktok.com/@x/video/123').id, 'tiktok');
    assert.equal(detectarPlataforma('https://www.instagram.com/reel/abc/').id, 'instagram');
    assert.equal(detectarPlataforma('https://www.facebook.com/watch/?v=123').id, 'facebook');
    assert.equal(detectarPlataforma('https://fb.watch/abc123/').id, 'facebook');
  });

  it('devuelve null para otras páginas', () => {
    assert.equal(detectarPlataforma('https://example.com/video.mp4'), null);
    assert.equal(detectarPlataforma('https://x.com/algo/status/123'), null);
    assert.equal(detectarPlataforma('no es un link'), null);
    assert.equal(detectarPlataforma(null), null);
  });
});

describe('descargas: esUrlVideo', () => {
  it('acepta links válidos de plataformas soportadas', () => {
    assert.equal(esUrlVideo('https://www.youtube.com/watch?v=jNQXAC9IVRw'), true);
    assert.equal(esUrlVideo('https://www.tiktok.com/@x/video/123'), true);
  });

  it('rechaza links inválidos o de otras páginas', () => {
    assert.equal(esUrlVideo('https://google.com/'), false);
    assert.equal(esUrlVideo('ftp://youtube.com/watch?v=x'), false);
    assert.equal(esUrlVideo('hola'), false);
    assert.equal(esUrlVideo(''), false);
  });
});

describe('descargas: descargarVideo rechaza sin bajar nada', () => {
  it('lanza error para plataforma no soportada sin llamar a yt-dlp', async () => {
    await assert.rejects(
      descargarVideo('https://example.com/video.mp4'),
      /no es de TikTok, YouTube, Instagram o Facebook/,
    );
  });
});
