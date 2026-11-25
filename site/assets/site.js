// Video slots of the website.
//
// The video files are not in this repository. They live on the server in
// /srv/sites/planback/medien/videos/ (see README, section "Videos") and are
// served from the same host, so no third-party service is involved.
//
// Every element with data-video="<name>" stays hidden until
// /medien/videos/<name>.mp4 exists. Then it gets a player with the poster
// <name>.jpg and the German subtitle track <name>.vtt. Elements with
// data-video-link (the "Videos" menu entry) appear once the overview video
// exists. Without JavaScript or without videos the pages simply show no player.
(function () {
  'use strict';

  var BASE = '/medien/videos/';
  var cache = {};

  function exists(name) {
    if (!cache[name]) {
      cache[name] = fetch(BASE + name + '.mp4', { method: 'HEAD', cache: 'no-store' })
        .then(function (response) { return response.ok; })
        .catch(function () { return false; });
    }
    return cache[name];
  }

  function player(name, title) {
    var video = document.createElement('video');
    video.controls = true;
    video.preload = 'none';
    video.poster = BASE + name + '.jpg';
    video.setAttribute('playsinline', '');
    if (title) {
      video.setAttribute('aria-label', title);
    }
    var source = document.createElement('source');
    source.src = BASE + name + '.mp4';
    source.type = 'video/mp4';
    video.appendChild(source);
    var track = document.createElement('track');
    track.kind = 'subtitles';
    track.srclang = 'de';
    track.label = 'Deutsch';
    track.src = BASE + name + '.vtt';
    video.appendChild(track);
    return video;
  }

  document.querySelectorAll('[data-video]').forEach(function (slot) {
    var name = slot.getAttribute('data-video');
    exists(name).then(function (ok) {
      if (!ok) {
        return;
      }
      var target = slot.querySelector('.player') || slot;
      target.appendChild(player(name, slot.getAttribute('data-title')));
      slot.hidden = false;
      document.dispatchEvent(new CustomEvent('planback:video', { detail: name }));
    });
  });

  exists('ueberblick').then(function (ok) {
    if (!ok) {
      return;
    }
    document.querySelectorAll('[data-video-link]').forEach(function (link) {
      link.hidden = false;
    });
  });
})();
