const system = require("sdk/system");
const child_process = require("sdk/system/child_process");
const { viewFor } = require("sdk/view/core");
const { isDocumentLoaded } = require("sdk/window/utils");
const { browserWindows } = require("sdk/windows");

/* Based on: https://github.com/sagebind/atom-gtk-dark-theme */
function exec(command, callback) {
  return child_process.exec(
    command,
    { env: { DISPLAY: system.env.DISPLAY, PATH: system.env.PATH } },
    callback
  );
}

function getFirefoxProcessIds() {
  let { processID } = require("sdk/system/runtime");
  return Promise.resolve([ processID ]);
}

/**
 * Gets the handle IDs of all currently open Firefox windows.
 *
 * @return Promise
 */
function getFirefoxWindowHandles() {
  // First, get all of the open windows and their respective process IDs.
  let windowPids = getAllWindowHandles().then(function(windowHandles) {
    let promises = [];

    // Go through each handle and fetch its owner process ID.
    for (let i = 0; i < windowHandles.length; i++) {
      let handle = windowHandles[i];
      promises.push(
        getWindowProcessId(handle).then(
          function(pid) {
            return { handle: handle, pid: pid };
          },
          function(reason) {}
        )
      );
    }

    return Promise.all(promises);
  });

  // Now, get all of Firefox's processes and match the window handles to see if
  // they belong to Firefox.
  let pids = getFirefoxProcessIds();
  return Promise.all([ pids, windowPids ]).then(function(values) {
    let handles = [];

    // For each window handle, if the window's PID is in the list of Firefox
    // PIDs, add the window's handle to the list.
    for (let i = 0; i < values[(1)].length; i++) {
      if (values[(1)][i] && values[(0)].indexOf(values[(1)][i].pid) > -1) {
        handles.push(values[(1)][i].handle);
      }
    }

    return handles;
  });
}

/**
 * Sets the GTK theme variant of all Firefox windows.
 *
 * @param [String] variant The GTK theme variant to set.
 *
 * @return Promise
 */
function setFirefoxGtkTheme(theme) {
  return getFirefoxWindowHandles().then(function(handles) {
    let promises = [];

    for (let i = 0; i < handles.length; i++) {
      let cmd = "xprop -id " + handles[i] + " -f _GTK_THEME_VARIANT 8u ";
      if (theme) {
        cmd += "-set _GTK_THEME_VARIANT " + theme;
      } else {
        cmd += "-remove _GTK_THEME_VARIANT";
      }

      promises.push(new Promise(function(resolve, reject) {
        exec(cmd, function(error, stdout, stderr) {
          if (error) {
            reject(error + ` (${cmd})`);
          } else {
            resolve();
          }
        });
      }));
    }

    return Promise.all(promises);
  });
}

/**
 * Gets the window handle IDs of all windows currently open.
 *
 * @return Promise
 */
function getAllWindowHandles() {
  return new Promise(function(resolve, reject) {
    exec("xprop -root _NET_CLIENT_LIST", function(error, stdout, stderr) {
      if (error) {
        return reject(error);
      }

      let ids = stdout.match(/0x(([a-z]|\d)+)/gi);
      resolve(ids);
    });
  });
}

/**
 * Gets the PID of the process that owns a window handle ID.
 *
 * @param [String] handle The window handle ID.
 *
 * @return Promise
 */
function getWindowProcessId(handle) {
  return new Promise(function(resolve, reject) {
    exec("xprop -id " + handle + " _NET_WM_PID", function(
      error,
      stdout,
      stderr
    ) {
      if (error || stdout.indexOf("_NET_WM_PID(CARDINAL)") == -1) {
        return reject(error);
      }

      let pid = parseFloat(stdout.match(/\d+/)[(0)]);
      resolve(pid);
    });
  });
}

function setDarkTheme() {
  setFirefoxGtkTheme("dark");
}

exports.main = () => {
  setDarkTheme();
  browserWindows.on("activate", setDarkTheme);
};
exports.onUnload = () => {
  setFirefoxGtkTheme();
  browserWindows.off("activate", setDarkTheme);
};
