// ==UserScript==
// @name Jsdelivr Auto Fallback
// @namespace https://github.com/PipecraftNet/jsdelivr-auto-fallback
// @version 0.2.1
// @author PipecraftNet&DreamOfIce
// @description 修复 cdn.jsdelivr.net 无法访问的问题
// @homepage https://github.com//jsdelivr-auto-fallback
// @downloadURL https://greasyfork.org/scripts/445701-jsdelivr-auto-fallback/code/Jsdelivr%20Auto%20Fallback.user.js
// @updateURL https://greasyfork.org/scripts/445701-jsdelivr-auto-fallback/code/Jsdelivr%20Auto%20Fallback.user.js
// @supportURL https://github.com/PipecraftNet/jsdelivr-auto-fallback/issues
// @license MIT
// @match *://*/*
// @run-at document-start
// @grant GM_setValue
// @grant GM_getValue
// ==/UserScript==

((document) => {
  'use strict';
  let fastNode;
  let failed;
  let isRunning;
  const DEST_LIST = [
    'cdn.jsdelivr.net',
    'fastly.jsdelivr.net',
    'gcore.jsdelivr.net',
    'cdn.zenless.top',
    'testingcf.jsdelivr.net',
    'test1.jsdelivr.net'
  ];
  const PREFIX = '//';
  const SOURCE = DEST_LIST[0];
  const starTime = Date.now();
  const TIMEOUT = 2000;
  const STORE_KEY = 'jsdelivr-auto-fallback';
  const TEST_PATH = '/gh/PipecraftNet/jsdelivr-auto-fallback@main/empty.css?';
  const shouldReplace = (text) => text && text.includes(PREFIX + SOURCE);
  const replace = (text) => text.replace(PREFIX + SOURCE, PREFIX + fastNode);
  const setTimeout = window.setTimeout;
  const $ = document.querySelectorAll.bind(document);

  const replaceElementSrc = () => {
    let element;
    let value;
    for (element of $('link[rel="stylesheet"]')) {
      value = element.href;
      if (shouldReplace(value) && !value.includes(TEST_PATH)) {
        element.href = replace(value);
      }
    }

    for (element of $('script')) {
      value = element.src;
      if (shouldReplace(value)) {
        const newNode = document.createElement('script');
        newNode.src = replace(value);
        element.defer = true;
        element.src = '';
        element.before(newNode);
        element.remove();
      }
    }

    for (element of $('img')) {
      value = element.src;
      if (shouldReplace(value)) {
        // Used to cancel loading. Without this line it will remain pending status.
        element.src = '';
        element.src = replace(value);
      }
    }

    // All elements that have a style attribute
    for (element of $('*[style]')) {
      value = element.getAttribute('style');
      if (shouldReplace(value)) {
        element.setAttribute('style', replace(value));
      }
    }

    for (element of $('style')) {
      value = element.innerHTML;
      if (shouldReplace(value)) {
        element.innerHTML = replace(value);
      }
    }
  };

  const tryReplace = () => {
    if (!isRunning && failed && fastNode) {
      console.warn(SOURCE + ' is not available. Use ' + fastNode);
      isRunning = true;
      setTimeout(replaceElementSrc, 0);
      // Some need to wait for a while
      setTimeout(replaceElementSrc, 20);
      // Replace dynamically added elements
      setInterval(replaceElementSrc, 500);
    }
  };

  const checkAvailable = (url, callback) => {
    let timeoutId;
    const newNode = document.createElement('link');
    const handleResult = (isSuccess) => {
      if (!timeoutId) {
        return;
      }

      clearTimeout(timeoutId);
      timeoutId = 0;
      // Used to cancel loading. Without this line it will remain pending status.
      if (!isSuccess) newNode.href = 'data:text/plain;base64,';
      newNode.remove();
      callback(isSuccess);
    };

    timeoutId = setTimeout(handleResult, TIMEOUT);

    newNode.addEventListener('error', () => handleResult(false));
    newNode.addEventListener('load', () => handleResult(true));
    newNode.rel = 'stylesheet';
    newNode.text = 'text/css';
    newNode.href = url + TEST_PATH + starTime;
    document.head.insertAdjacentElement('afterbegin', newNode);
  };

  const cached = (() => {
    try {
      return Object.assign(
        {},
        JSON.parse(GM_getValue(STORE_KEY) || '{}')
      );
    } catch {
      return {};
    }
  })();

  const main = () => {
    cached.time = starTime;
    cached.failed = false;
    cached.fastNode = null;

    for (const url of DEST_LIST) {
      checkAvailable('https://' + url, (isAvailable) => {
        // console.log(url, Date.now() - starTime, Boolean(isAvailable));
        if (!isAvailable && url === SOURCE) {
          failed = true;
          cached.failed = true;
        }

        if (isAvailable && !fastNode) {
          fastNode = url;
        }

        if (isAvailable && !cached.fastNode) {
          cached.fastNode = url;
        }

        tryReplace();
      });
    }

    setTimeout(() => {
      // If all domains are timeout
      if (failed && !fastNode) {
        fastNode = DEST_LIST[1];
        tryReplace();
      }

      GM_setValue(STORE_KEY, JSON.stringify(cached));
    }, TIMEOUT + 100);
  };

  if (
    cached.time &&
    starTime - cached.time < 60 * 60 * 1000 &&
    cached.failed &&
    cached.fastNode
  ) {
    failed = true;
    fastNode = cached.fastNode;
    tryReplace();
    setTimeout(main, 1000);
  } else {
    main();
  }
})(document);
