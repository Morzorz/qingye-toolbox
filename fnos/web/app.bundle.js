try {
(() => {
  // node_modules/@trimjs/web-app/dist/index.js
  function e(t2) {
    return e = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e2) {
      return typeof e2;
    } : function(e2) {
      return e2 && "function" == typeof Symbol && e2.constructor === Symbol && e2 !== Symbol.prototype ? "symbol" : typeof e2;
    }, e(t2);
  }
  function t(t2) {
    var r2 = (function(t3, r3) {
      if ("object" != e(t3) || !t3) return t3;
      var n2 = t3[Symbol.toPrimitive];
      if (void 0 !== n2) {
        var i2 = n2.call(t3, r3 || "default");
        if ("object" != e(i2)) return i2;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === r3 ? String : Number)(t3);
    })(t2, "string");
    return "symbol" == e(r2) ? r2 : r2 + "";
  }
  function r(e2, r2, n2) {
    return (r2 = t(r2)) in e2 ? Object.defineProperty(e2, r2, { value: n2, enumerable: true, configurable: true, writable: true }) : e2[r2] = n2, e2;
  }
  var n = new class {
    constructor() {
      r(this, "debug", false);
    }
    setDebug(e2) {
      this.debug = e2;
    }
    isDebug() {
      return this.debug;
    }
    log() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.log("[Trim App]", ...t2);
      }
    }
    warn() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.warn("[Trim App]", ...t2);
      }
    }
    error() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.error("[Trim App]", ...t2);
      }
    }
    info() {
      if (this.debug) {
        for (var e2 = arguments.length, t2 = new Array(e2), r2 = 0; r2 < e2; r2++) t2[r2] = arguments[r2];
        console.info("[Trim App]", ...t2);
      }
    }
  }();
  var i = () => (function(e2) {
    const t2 = /FNOS\/([\d.]+)|FNAppType\/(\w+)|FNAppVer\/([\d.]+)/g, r2 = {};
    let n2;
    for (; null !== (n2 = t2.exec(e2)); ) n2[1] && (r2.fnOSVersion = n2[1]), n2[2] && (r2.fnAppType = n2[2]), n2[3] && (r2.fnAppVersion = n2[3]);
    return r2;
  })(navigator.userAgent).fnAppVersion;
  function o(e2, t2, r2, n2, i2, o2, s2) {
    try {
      var l2 = e2[o2](s2), a2 = l2.value;
    } catch (e3) {
      return void r2(e3);
    }
    l2.done ? t2(a2) : Promise.resolve(a2).then(n2, i2);
  }
  function s(e2) {
    return function() {
      var t2 = this, r2 = arguments;
      return new Promise(function(n2, i2) {
        var s2 = e2.apply(t2, r2);
        function l2(e3) {
          o(s2, n2, i2, l2, a2, "next", e3);
        }
        function a2(e3) {
          o(s2, n2, i2, l2, a2, "throw", e3);
        }
        l2(void 0);
      });
    };
  }
  function l(e2, t2) {
    var r2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var n2 = Object.getOwnPropertySymbols(e2);
      t2 && (n2 = n2.filter(function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      })), r2.push.apply(r2, n2);
    }
    return r2;
  }
  function a(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = null != arguments[t2] ? arguments[t2] : {};
      t2 % 2 ? l(Object(n2), true).forEach(function(t3) {
        r(e2, t3, n2[t3]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : l(Object(n2)).forEach(function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      });
    }
    return e2;
  }
  var u = false;
  window.addEventListener("flutterInAppWebViewPlatformReady", () => {
    u = true;
  });
  var c = /(iPad|iPhone|iPod|Macintosh|Mac OS X)/i.test(navigator.userAgent);
  var p = /* @__PURE__ */ (function() {
    var e2 = s(function* (e3, t2) {
      for (var r2 = arguments.length, i2 = new Array(r2 > 2 ? r2 - 2 : 0), o2 = 2; o2 < r2; o2++) i2[o2 - 2] = arguments[o2];
      n.log(`callHandler: ${t2}, params: ${i2.map((e4) => String(e4)).join(", ")}`);
      const s2 = yield e3.callHandler(t2, ...i2);
      if (s2) try {
        const e4 = JSON.parse(s2);
        n.log(`messageData: ${JSON.stringify(e4)}`);
        const t3 = JSON.parse(e4.result);
        return n.log(`appMessage: ${JSON.stringify(t3)}`), t3;
      } catch (l2) {
        return n.error(`error: ${l2}`), null;
      }
      return null;
    });
    return function(t2, r2) {
      return e2.apply(this, arguments);
    };
  })();
  var d = /* @__PURE__ */ new Map();
  var f = class {
    constructor(e2) {
      r(this, "subscribeFn", void 0), this.subscribeFn = e2;
    }
    subscribe(e2, t2, r2) {
      var n2;
      const i2 = "function" == typeof e2 ? { next: e2, error: t2, complete: r2 } : null != e2 ? e2 : {};
      let o2 = false;
      const s2 = null !== (n2 = this.subscribeFn({ next: (e3) => {
        var t3;
        o2 || (null === (t3 = i2.next) || void 0 === t3 || t3.call(i2, e3));
      }, error: (e3) => {
        var t3;
        o2 || (o2 = true, null === (t3 = i2.error) || void 0 === t3 || t3.call(i2, e3));
      }, complete: () => {
        var e3;
        o2 || (o2 = true, null === (e3 = i2.complete) || void 0 === e3 || e3.call(i2));
      } })) && void 0 !== n2 ? n2 : () => {
      };
      return { unsubscribe: () => {
        o2 || (o2 = true, s2());
      } };
    }
  };
  var h = /* @__PURE__ */ new Map();
  function v() {
    window._flutter_onAppObservableQueryResult = (e2) => {
      n.log("_flutter_onAppObservableQueryResult", e2);
      const t2 = (function(e3) {
        var t3, r3;
        const n2 = "string" == typeof e3 ? JSON.parse(e3) : e3, i2 = null !== (t3 = n2.reqid) && void 0 !== t3 ? t3 : n2.reqId;
        return a(a({}, n2), {}, { reqId: null !== (r3 = n2.reqId) && void 0 !== r3 ? r3 : i2, reqid: i2 });
      })(e2), r2 = h.get(t2.reqId);
      if (r2) if (t2.result && "doing" !== t2.result) {
        if ("succ" === t2.result) return r2.next(t2), r2.complete(), void h.delete(t2.reqId);
        r2.error(t2), h.delete(t2.reqId);
      } else r2.next(t2);
      else n.log("_flutter_onAppObservableQueryResult observer not found", t2);
    };
  }
  function y() {
    return (y = s(function* (e2, t2) {
      return new Promise((r2, i2) => {
        null == e2 || e2.callHandler("openFolder", JSON.stringify(t2)).then((e3) => {
          if (n.log("pickFilePromise callback registered", { reqId: e3, params: t2 }), e3) {
            let o2 = function(e4) {
              r2(e4.result);
            };
            d.set(e3, o2);
          } else i2(/* @__PURE__ */ new Error("openFolder failed"));
        });
      });
    })).apply(this, arguments);
  }
  i() && (window.fnAppMessage = (e2) => {
    n.log("app-message", e2);
    const t2 = JSON.parse(e2), r2 = d.get(t2.reqId);
    r2 && (r2(t2), d.delete(t2.reqId));
  }), i() && v();
  var g = /* @__PURE__ */ (function(e2) {
    return e2.Call = "call", e2.Reply = "reply", e2.Syn = "syn", e2.SynAck = "synAck", e2.Ack = "ack", e2;
  })({});
  var b = /* @__PURE__ */ (function(e2) {
    return e2.Fulfilled = "fulfilled", e2.Rejected = "rejected", e2;
  })({});
  var m = /* @__PURE__ */ (function(e2) {
    return e2.ConnectionDestroyed = "ConnectionDestroyed", e2.ConnectionTimeout = "ConnectionTimeout", e2.NoIframeSrc = "NoIframeSrc", e2;
  })({});
  var w = /* @__PURE__ */ (function(e2) {
    return e2.DataCloneError = "DataCloneError", e2;
  })({});
  var A = /* @__PURE__ */ (function(e2) {
    return e2.Message = "message", e2;
  })({});
  var S = ({ name: e2, message: t2, stack: r2 }) => ({ name: e2, message: t2, stack: r2 });
  var O = (e2, t2, r2) => {
    let { localName: n2, local: i2, remote: o2, originForSending: s2, originForReceiving: l2 } = e2, a2 = false, u2 = (e3) => {
      if (e3.source !== o2 || e3.data.penpal !== g.Call) return;
      if ("*" !== l2 && e3.origin !== l2) return void r2(`${n2} received message from origin ${e3.origin} which did not match expected origin ${l2}`);
      let { methodName: i3, args: u3, id: c2 } = e3.data;
      r2(`${n2}: Received ${i3}() call`);
      let p2 = (e4) => (t3) => {
        if (r2(`${n2}: Sending ${i3}() reply`), a2) return void r2(`${n2}: Unable to send ${i3}() reply due to destroyed connection`);
        let l3 = { penpal: g.Reply, id: c2, resolution: e4, returnValue: t3 };
        e4 === b.Rejected && t3 instanceof Error && (l3.returnValue = S(t3), l3.returnValueIsError = true);
        try {
          o2.postMessage(l3, s2);
        } catch (e5) {
          let r3 = e5 instanceof Error ? e5 : Error(String(e5));
          if (r3.name === w.DataCloneError) {
            let e6 = { penpal: g.Reply, id: c2, resolution: b.Rejected, returnValue: S(r3), returnValueIsError: true };
            o2.postMessage(e6, s2);
          }
          throw e5;
        }
      };
      new Promise((e4) => e4(t2[i3].apply(t2, u3))).then(p2(b.Fulfilled), p2(b.Rejected));
    };
    return i2.addEventListener(A.Message, u2), () => {
      a2 = true, i2.removeEventListener(A.Message, u2);
    };
  };
  var P = 0;
  var E = () => ++P;
  var M = (e2) => e2 ? e2.split(".") : [];
  var F = (e2, t2, r2) => {
    let n2 = M(t2);
    return n2.reduce((e3, t3, i2) => (void 0 === e3[t3] && (e3[t3] = {}), i2 === n2.length - 1 && (e3[t3] = r2), e3[t3]), e2), e2;
  };
  var $ = (e2, t2) => {
    let r2 = {};
    return Object.keys(e2).forEach((n2) => {
      let i2 = e2[n2], o2 = ((e3, t3) => {
        let r3 = M(t3 || "");
        return r3.push(e3), ((e4) => e4.join("."))(r3);
      })(n2, t2);
      "object" == typeof i2 && Object.assign(r2, $(i2, o2)), "function" == typeof i2 && (r2[o2] = i2);
    }), r2;
  };
  var _ = (e2, t2, r2, n2, i2) => {
    let { localName: o2, local: s2, remote: l2, originForSending: a2, originForReceiving: u2 } = t2, c2 = false, p2 = /* @__PURE__ */ new Set();
    i2(`${o2}: Connecting call sender`);
    let d2 = (e3) => (...r3) => {
      let d3;
      i2(`${o2}: Sending ${e3}() call`);
      try {
        l2.closed && (d3 = true);
      } catch (g2) {
        d3 = true;
      }
      if (d3 && n2(), c2) {
        let t3 = /* @__PURE__ */ Error(`Unable to send ${e3}() call due to destroyed connection`);
        throw t3.code = m.ConnectionDestroyed, t3;
      }
      return new Promise((n3, c3) => {
        var d4;
        let f3, h2 = E(), v2 = () => {
          s2.removeEventListener(A.Message, m2), void 0 !== f3 && clearTimeout(f3), p2.delete(y2);
        }, y2 = () => {
          v2(), c3(/* @__PURE__ */ Error("Connection closed"));
        }, m2 = (t3) => {
          var r4;
          if (t3.source !== l2 || (null == (r4 = t3.data) ? void 0 : r4.penpal) !== g.Reply || t3.data.id !== h2) return;
          if ("*" !== u2 && t3.origin !== u2) return void i2(`${o2} received message from origin ${t3.origin} which did not match expected origin ${u2}`);
          let s3 = t3.data;
          i2(`${o2}: Received ${e3}() reply`), v2();
          let a3 = s3.returnValue;
          s3.returnValueIsError && (a3 = ((e4) => {
            let t4 = /* @__PURE__ */ Error();
            return Object.assign(t4, e4), t4;
          })(a3)), (s3.resolution === b.Fulfilled ? n3 : c3)(a3);
        };
        s2.addEventListener(A.Message, m2), p2.add(y2);
        let w2 = null == (d4 = t2.callTimeouts) ? void 0 : d4[e3];
        void 0 !== w2 && (f3 = setTimeout(y2, w2));
        let S2 = { penpal: g.Call, id: h2, methodName: e3, args: r3 };
        try {
          l2.postMessage(S2, a2);
        } catch (g2) {
          v2(), c3(g2);
        }
      });
    }, f2 = r2.reduce((e3, t3) => (e3[t3] = d2(t3), e3), {});
    return Object.assign(e2, ((e3) => {
      let t3 = {};
      for (let r3 in e3) F(t3, r3, e3[r3]);
      return t3;
    })(f2)), () => {
      c2 = true;
      for (let e3 of p2) e3();
    };
  };
  var k = (e2, t2) => {
    let r2;
    return void 0 !== e2 && (r2 = window.setTimeout(() => {
      let r3 = /* @__PURE__ */ Error(`Connection timed out after ${e2}ms`);
      r3.code = m.ConnectionTimeout, t2(r3);
    }, e2)), () => {
      clearTimeout(r2);
    };
  };
  function T(e2) {
    return T = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && "function" == typeof Symbol && e3.constructor === Symbol && e3 !== Symbol.prototype ? "symbol" : typeof e3;
    }, T(e2);
  }
  function j(e2) {
    var t2 = (function(e3, t3) {
      if ("object" != T(e3) || !e3) return e3;
      var r2 = e3[Symbol.toPrimitive];
      if (void 0 !== r2) {
        var n2 = r2.call(e3, t3 || "default");
        if ("object" != T(n2)) return n2;
        throw TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t3 ? String : Number)(e3);
    })(e2, "string");
    return "symbol" == T(t2) ? t2 : t2 + "";
  }
  function N(e2, t2, r2) {
    return (t2 = j(t2)) in e2 ? Object.defineProperty(e2, t2, { value: r2, enumerable: true, configurable: true, writable: true }) : e2[t2] = r2, e2;
  }
  function W(e2, t2) {
    var r2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var n2 = Object.getOwnPropertySymbols(e2);
      t2 && (n2 = n2.filter(function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      })), r2.push.apply(r2, n2);
    }
    return r2;
  }
  function C(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var r2 = null == arguments[t2] ? {} : arguments[t2];
      t2 % 2 ? W(Object(r2), true).forEach(function(t3) {
        N(e2, t3, r2[t3]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(r2)) : W(Object(r2)).forEach(function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(r2, t3));
      });
    }
    return e2;
  }
  var q = (e2, t2, r2, n2, i2, o2) => {
    let { destroy: s2, onDestroy: l2 } = n2;
    return (n3) => {
      if (!(e2 instanceof RegExp ? e2.test(n3.origin) : "*" === e2 || e2 === n3.origin)) return void i2(`Child: Handshake - Received SYN-ACK from origin ${n3.origin} which did not match expected origin ${e2}`);
      i2("Child: Handshake - Received SYN-ACK, responding with ACK");
      let a2 = "null" === n3.origin ? "*" : n3.origin, u2 = { penpal: g.Ack, methodNames: Object.keys(t2), config: r2 };
      window.parent.postMessage(u2, a2);
      let c2 = { callTimeouts: o2, localName: "Child", local: window, remote: window.parent, originForSending: a2, originForReceiving: n3.origin }, p2 = O(c2, t2, i2);
      l2(p2);
      let d2 = {}, f2 = _(d2, c2, n3.data.methodNames, s2, i2);
      return l2(f2), d2;
    };
  };
  function x(e2, t2) {
    var r2;
    null == (r2 = console) || r2.warn(`[fnApp warn]: ${e2}`, t2);
  }
  function I(e2, t2) {
    var r2;
    null == (r2 = console) || r2.error(`[fnApp error]: ${e2}`, t2);
  }
  var U = "_fn_all_event";
  var V = "事件订阅数量为空";
  function R(e2) {
    return R = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && "function" == typeof Symbol && e3.constructor === Symbol && e3 !== Symbol.prototype ? "symbol" : typeof e3;
    }, R(e2);
  }
  function D(e2) {
    var t2 = (function(e3, t3) {
      if ("object" != R(e3) || !e3) return e3;
      var r2 = e3[Symbol.toPrimitive];
      if (void 0 !== r2) {
        var n2 = r2.call(e3, t3 || "default");
        if ("object" != R(n2)) return n2;
        throw TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t3 ? String : Number)(e3);
    })(e2, "string");
    return "symbol" == R(t2) ? t2 : t2 + "";
  }
  function z(e2, t2, r2) {
    return (t2 = D(t2)) in e2 ? Object.defineProperty(e2, t2, { value: r2, enumerable: true, configurable: true, writable: true }) : e2[t2] = r2, e2;
  }
  var L = window.__POWERED_BY_FNAPP__ ? window.__FNAPP.inject.appEventObjMap : /* @__PURE__ */ new Map();
  var J = class {
    constructor(e2, t2) {
      z(this, "id", void 0), z(this, "appName", void 0), z(this, "eventObj", void 0), z(this, "getEventCallBackLength", (e3) => {
        var t3;
        return (null == (t3 = this.eventObj[e3]) ? void 0 : t3.length) || 0;
      }), this.id = e2, this.appName = t2, this.$clear(), L.get(this.id) || L.set(this.id, {}), this.eventObj = L.get(this.id);
    }
    $on(e2, t2) {
      let r2 = this.eventObj[e2];
      return r2 ? (r2.includes(t2) || r2.push(t2), this) : (this.eventObj[e2] = [t2], this);
    }
    $onAll(e2) {
      return this.$on(U, e2);
    }
    $once(e2, t2) {
      t2.$__once = true, this.$on(e2, t2);
    }
    $off(e2, t2) {
      let r2 = this.eventObj[e2];
      if (!e2 || !r2 || !r2.length) return x(`${e2} ${V}`), this;
      let n2, i2 = r2.length;
      for (; i2--; ) if (n2 = r2[i2], n2 === t2) {
        r2.splice(i2, 1);
        break;
      }
      return this;
    }
    $offAll(e2) {
      return this.$off(U, e2);
    }
    $emit(e2, ...t2) {
      return e2 = `${this.appName}/${e2}`, this.$pureEmit(e2, ...t2);
    }
    $pureEmit(e2, ...t2) {
      let r2 = 0;
      return L.forEach((n2) => {
        if (n2[e2]) for (let i2 = n2[e2].length - 1; i2 >= 0; i2--) {
          r2++;
          let o2 = n2[e2][i2];
          o2.$__once && n2[e2].splice(i2, 1);
          try {
            o2(...t2);
          } catch (e3) {
            I(e3);
          }
        }
        if (n2._fn_all_event) for (let i2 = n2[U].length - 1; i2 >= 0; i2--) {
          r2++;
          let o2 = n2[U][i2];
          o2.$__once && n2[U].splice(i2, 1);
          try {
            o2(...t2);
          } catch (e3) {
            I(e3);
          }
        }
      }), (!e2 || 0 === r2) && x(`${e2} ${V}`), this;
    }
    $clear() {
      var e2;
      let t2 = null == (e2 = L.get(this.id)) ? {} : e2;
      return Object.keys(t2).forEach((e3) => delete t2[e3]), this;
    }
  };
  var H = function(e2, t2) {
    return H = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e3, t3) {
      e3.__proto__ = t3;
    } || function(e3, t3) {
      for (var r2 in t3) Object.prototype.hasOwnProperty.call(t3, r2) && (e3[r2] = t3[r2]);
    }, H(e2, t2);
  };
  function Q(e2, t2) {
    if ("function" != typeof t2 && null !== t2) throw TypeError("Class extends value " + String(t2) + " is not a constructor or null");
    function r2() {
      this.constructor = e2;
    }
    H(e2, t2), e2.prototype = null === t2 ? Object.create(t2) : (r2.prototype = t2.prototype, new r2());
  }
  function B(e2) {
    var t2 = "function" == typeof Symbol && Symbol.iterator, r2 = t2 && e2[t2], n2 = 0;
    if (r2) return r2.call(e2);
    if (e2 && "number" == typeof e2.length) return { next: function() {
      return e2 && n2 >= e2.length && (e2 = void 0), { value: e2 && e2[n2++], done: !e2 };
    } };
    throw TypeError(t2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function Y(e2, t2) {
    var r2 = "function" == typeof Symbol && e2[Symbol.iterator];
    if (!r2) return e2;
    var n2, i2, o2 = r2.call(e2), s2 = [];
    try {
      for (; (void 0 === t2 || t2-- > 0) && !(n2 = o2.next()).done; ) s2.push(n2.value);
    } catch (e3) {
      i2 = { error: e3 };
    } finally {
      try {
        n2 && !n2.done && (r2 = o2.return) && r2.call(o2);
      } finally {
        if (i2) throw i2.error;
      }
    }
    return s2;
  }
  function G(e2, t2, r2) {
    if (r2 || 2 === arguments.length) for (var n2, i2 = 0, o2 = t2.length; i2 < o2; i2++) (n2 || !(i2 in t2)) && (n2 || (n2 = Array.prototype.slice.call(t2, 0, i2)), n2[i2] = t2[i2]);
    return e2.concat(n2 || Array.prototype.slice.call(t2));
  }
  function K(e2) {
    return "function" == typeof e2;
  }
  var X = (function(e2) {
    var t2 = e2(function(e3) {
      Error.call(e3), e3.stack = Error().stack;
    });
    return t2.prototype = Object.create(Error.prototype), t2.prototype.constructor = t2, t2;
  })(function(e2) {
    return function(t2) {
      e2(this), this.message = t2 ? t2.length + " errors occurred during unsubscription:\n" + t2.map(function(e3, t3) {
        return t3 + 1 + ") " + e3.toString();
      }).join("\n  ") : "", this.name = "UnsubscriptionError", this.errors = t2;
    };
  });
  function Z(e2, t2) {
    if (e2) {
      var r2 = e2.indexOf(t2);
      0 <= r2 && e2.splice(r2, 1);
    }
  }
  var ee = (function() {
    function e2(e3) {
      this.initialTeardown = e3, this.closed = false, this._parentage = null, this._finalizers = null;
    }
    return e2.prototype.unsubscribe = function() {
      var e3, t2, r2, n2, i2;
      if (!this.closed) {
        this.closed = true;
        var o2 = this._parentage;
        if (o2) if (this._parentage = null, Array.isArray(o2)) try {
          for (var s2 = B(o2), l2 = s2.next(); !l2.done; l2 = s2.next()) l2.value.remove(this);
        } catch (t3) {
          e3 = { error: t3 };
        } finally {
          try {
            l2 && !l2.done && (t2 = s2.return) && t2.call(s2);
          } finally {
            if (e3) throw e3.error;
          }
        }
        else o2.remove(this);
        var a2 = this.initialTeardown;
        if (K(a2)) try {
          a2();
        } catch (e4) {
          i2 = e4 instanceof X ? e4.errors : [e4];
        }
        var u2 = this._finalizers;
        if (u2) {
          this._finalizers = null;
          try {
            for (var c2 = B(u2), p2 = c2.next(); !p2.done; p2 = c2.next()) {
              var d2 = p2.value;
              try {
                re(d2);
              } catch (e4) {
                i2 = null == i2 ? [] : i2, e4 instanceof X ? i2 = G(G([], Y(i2)), Y(e4.errors)) : i2.push(e4);
              }
            }
          } catch (e4) {
            r2 = { error: e4 };
          } finally {
            try {
              p2 && !p2.done && (n2 = c2.return) && n2.call(c2);
            } finally {
              if (r2) throw r2.error;
            }
          }
        }
        if (i2) throw new X(i2);
      }
    }, e2.prototype.add = function(t2) {
      var r2;
      if (t2 && t2 !== this) if (this.closed) re(t2);
      else {
        if (t2 instanceof e2) {
          if (t2.closed || t2._hasParent(this)) return;
          t2._addParent(this);
        }
        (this._finalizers = null == (r2 = this._finalizers) ? [] : r2).push(t2);
      }
    }, e2.prototype._hasParent = function(e3) {
      var t2 = this._parentage;
      return t2 === e3 || Array.isArray(t2) && t2.includes(e3);
    }, e2.prototype._addParent = function(e3) {
      var t2 = this._parentage;
      this._parentage = Array.isArray(t2) ? (t2.push(e3), t2) : t2 ? [t2, e3] : e3;
    }, e2.prototype._removeParent = function(e3) {
      var t2 = this._parentage;
      t2 === e3 ? this._parentage = null : Array.isArray(t2) && Z(t2, e3);
    }, e2.prototype.remove = function(t2) {
      var r2 = this._finalizers;
      r2 && Z(r2, t2), t2 instanceof e2 && t2._removeParent(this);
    }, e2.EMPTY = (function() {
      var t2 = new e2();
      return t2.closed = true, t2;
    })(), e2;
  })();
  function te(e2) {
    return e2 instanceof ee || e2 && "closed" in e2 && K(e2.remove) && K(e2.add) && K(e2.unsubscribe);
  }
  function re(e2) {
    K(e2) ? e2() : e2.unsubscribe();
  }
  ee.EMPTY;
  var ne = null;
  var ie = null;
  var oe = void 0;
  var se = false;
  var le = false;
  var ae = { setTimeout: function(e2, t2) {
    var r2 = [...arguments].slice(2), n2 = ae.delegate;
    return null != n2 && n2.setTimeout ? n2.setTimeout.apply(n2, G([e2, t2], Y(r2))) : setTimeout.apply(void 0, G([e2, t2], Y(r2)));
  }, clearTimeout: function(e2) {
    var t2 = ae.delegate;
    return ((null == t2 ? void 0 : t2.clearTimeout) || clearTimeout)(e2);
  }, delegate: void 0 };
  function ue() {
  }
  var ce = pe("C", void 0, void 0);
  function pe(e2, t2, r2) {
    return { kind: e2, value: t2, error: r2 };
  }
  var de = null;
  var fe = (function(e2) {
    function t2(t3) {
      var r2 = e2.call(this) || this;
      return r2.isStopped = false, t3 ? (r2.destination = t3, te(t3) && t3.add(r2)) : r2.destination = we, r2;
    }
    return Q(t2, e2), t2.create = function(e3, t3, r2) {
      return new ge(e3, t3, r2);
    }, t2.prototype.next = function(e3) {
      this.isStopped ? me((function(e4) {
        return pe("N", e4, void 0);
      })(e3), this) : this._next(e3);
    }, t2.prototype.error = function(e3) {
      this.isStopped ? me((function(e4) {
        return pe("E", void 0, e4);
      })(e3), this) : (this.isStopped = true, this._error(e3));
    }, t2.prototype.complete = function() {
      this.isStopped ? me(ce, this) : (this.isStopped = true, this._complete());
    }, t2.prototype.unsubscribe = function() {
      this.closed || (this.isStopped = true, e2.prototype.unsubscribe.call(this), this.destination = null);
    }, t2.prototype._next = function(e3) {
      this.destination.next(e3);
    }, t2.prototype._error = function(e3) {
      try {
        this.destination.error(e3);
      } finally {
        this.unsubscribe();
      }
    }, t2.prototype._complete = function() {
      try {
        this.destination.complete();
      } finally {
        this.unsubscribe();
      }
    }, t2;
  })(ee);
  var he = Function.prototype.bind;
  function ve(e2, t2) {
    return he.call(e2, t2);
  }
  var ye = (function() {
    function e2(e3) {
      this.partialObserver = e3;
    }
    return e2.prototype.next = function(e3) {
      var t2 = this.partialObserver;
      if (t2.next) try {
        t2.next(e3);
      } catch (e4) {
        be(e4);
      }
    }, e2.prototype.error = function(e3) {
      var t2 = this.partialObserver;
      if (t2.error) try {
        t2.error(e3);
      } catch (e4) {
        be(e4);
      }
      else be(e3);
    }, e2.prototype.complete = function() {
      var e3 = this.partialObserver;
      if (e3.complete) try {
        e3.complete();
      } catch (e4) {
        be(e4);
      }
    }, e2;
  })();
  var ge = (function(e2) {
    function t2(t3, r2, n2) {
      var i2, o2, s2 = e2.call(this) || this;
      K(t3) || !t3 ? i2 = { next: null == t3 ? void 0 : t3, error: null == r2 ? void 0 : r2, complete: null == n2 ? void 0 : n2 } : s2 && le ? ((o2 = Object.create(t3)).unsubscribe = function() {
        return s2.unsubscribe();
      }, i2 = { next: t3.next && ve(t3.next, o2), error: t3.error && ve(t3.error, o2), complete: t3.complete && ve(t3.complete, o2) }) : i2 = t3;
      return s2.destination = new ye(i2), s2;
    }
    return Q(t2, e2), t2;
  })(fe);
  function be(e2) {
    se ? (function(e3) {
      se && de && (de.errorThrown = true, de.error = e3);
    })(e2) : (function(e3) {
      ae.setTimeout(function() {
        if (!ne) throw e3;
        ne(e3);
      });
    })(e2);
  }
  function me(e2, t2) {
    var r2 = ie;
    r2 && ae.setTimeout(function() {
      return r2(e2, t2);
    });
  }
  var we = { closed: true, next: ue, error: function(e2) {
    throw e2;
  }, complete: ue };
  var Ae = "function" == typeof Symbol && Symbol.observable || "@@observable";
  function Se(e2) {
    return e2;
  }
  var Oe = (function() {
    function e2(e3) {
      e3 && (this._subscribe = e3);
    }
    return e2.prototype.lift = function(t2) {
      var r2 = new e2();
      return r2.source = this, r2.operator = t2, r2;
    }, e2.prototype.subscribe = function(e3, t2, r2) {
      var n2 = this, i2 = (function(e4) {
        return e4 && e4 instanceof fe || (function(e5) {
          return e5 && K(e5.next) && K(e5.error) && K(e5.complete);
        })(e4) && te(e4);
      })(e3) ? e3 : new ge(e3, t2, r2);
      return (function(e4) {
        if (se) {
          var t3 = !de;
          if (t3 && (de = { errorThrown: false, error: null }), e4(), t3) {
            var r3 = de, n3 = r3.errorThrown, i3 = r3.error;
            if (de = null, n3) throw i3;
          }
        } else e4();
      })(function() {
        var e4 = n2, t3 = e4.operator, r3 = e4.source;
        i2.add(t3 ? t3.call(i2, r3) : r3 ? n2._subscribe(i2) : n2._trySubscribe(i2));
      }), i2;
    }, e2.prototype._trySubscribe = function(e3) {
      try {
        return this._subscribe(e3);
      } catch (b2) {
        e3.error(b2);
      }
    }, e2.prototype.forEach = function(e3, t2) {
      var r2 = this;
      return new (t2 = Pe(t2))(function(t3, n2) {
        var i2 = new ge({ next: function(t4) {
          try {
            e3(t4);
          } catch (e4) {
            n2(e4), i2.unsubscribe();
          }
        }, error: n2, complete: t3 });
        r2.subscribe(i2);
      });
    }, e2.prototype._subscribe = function(e3) {
      var t2;
      return null == (t2 = this.source) ? void 0 : t2.subscribe(e3);
    }, e2.prototype[Ae] = function() {
      return this;
    }, e2.prototype.pipe = function() {
      return (function(e3) {
        return 0 === e3.length ? Se : 1 === e3.length ? e3[0] : function(t2) {
          return e3.reduce(function(e4, t3) {
            return t3(e4);
          }, t2);
        };
      })([...arguments])(this);
    }, e2.prototype.toPromise = function(e3) {
      var t2 = this;
      return new (e3 = Pe(e3))(function(e4, r2) {
        var n2;
        t2.subscribe(function(e5) {
          return n2 = e5;
        }, function(e5) {
          return r2(e5);
        }, function() {
          return e4(n2);
        });
      });
    }, e2.create = function(t2) {
      return new e2(t2);
    }, e2;
  })();
  function Pe(e2) {
    var t2;
    return null == (t2 = null == e2 ? oe : e2) ? Promise : t2;
  }
  function Ee(e2, t2, r2, n2, i2, o2, s2) {
    try {
      var l2 = e2[o2](s2), a2 = l2.value;
    } catch (e3) {
      return void r2(e3);
    }
    l2.done ? t2(a2) : Promise.resolve(a2).then(n2, i2);
  }
  function Me(e2) {
    return function() {
      var t2 = this, r2 = arguments;
      return new Promise(function(n2, i2) {
        var o2 = e2.apply(t2, r2);
        function s2(e3) {
          Ee(o2, n2, i2, s2, l2, "next", e3);
        }
        function l2(e3) {
          Ee(o2, n2, i2, s2, l2, "throw", e3);
        }
        s2(void 0);
      });
    };
  }
  var Fe = (e2 = {}) => {
    let { parentOrigin: t2 = "*", timeout: r2, debug: n2 = false, config: i2 = {} } = e2, o2 = /* @__PURE__ */ ((e3) => (...t3) => {
      e3 && console.log("[Penpal]", ...t3);
    })(n2), s2 = /* @__PURE__ */ ((e3, t3) => {
      let r3 = [], n3 = false;
      return { destroy(i3) {
        n3 || (n3 = true, t3(`${e3}: Destroying connection`), r3.forEach((e4) => {
          e4(i3);
        }));
      }, onDestroy(e4) {
        n3 ? e4() : r3.push(e4);
      } };
    })("App", o2), { destroy: l2, onDestroy: a2 } = s2;
    return { promise: new Promise((n3, u2) => {
      let c2 = k(r2, l2), p2 = (r3) => {
        if ((() => {
          try {
            clearTimeout(void 0);
          } catch (g2) {
            return false;
          }
          return true;
        })() && r3.source === parent && r3.data && r3.data.penpal === g.SynAck) {
          let l3 = r3.data, a3 = new J(l3.id, l3.appName), u3 = new J(l3.id + "/api", l3.appName), d2 = l3.id, f2 = {}, h2 = (e3) => "api/" + e3, v2 = { $emit: (e3, ...t3) => {
            a3.getEventCallBackLength(e3) > 0 ? a3.$pureEmit(e3, ...t3) : null == f2 || f2.$off(e3, () => {
            }, true);
          }, onQueryResult: (e3) => {
            u3.$pureEmit(h2(e3.reqid), e3);
          }, onOsNotify: (e3) => {
          } }, y2 = (e3) => function(t3) {
            let r4 = h2(e3);
            u3.$on(r4, function e4(n4) {
              t3.next(n4), n4.reqid && "succ" === n4.result && (t3.complete(), u3.$off(r4, e4));
            });
          }, g2 = $(v2), b2 = q(t2, g2, C(C({}, i2), {}, { postmateVersion: "0.1.5" }), s2, o2, e2.callTimeouts)(r3), m2 = {}, w2 = b2.bus;
          if (w2) {
            let e3 = (e4, t3, r4) => {
              r4 ? (t3.$__once = true, a3.$once(e4, t3)) : a3.$on(e4, t3), m2[e4] ? m2[e4].push(t3) : (m2[e4] = [t3], w2.$on(e4, d2));
            };
            Object.assign(f2, w2, { $on: e3, $off: (e4, t3, r4) => {
              var n4;
              if (m2[e4]) {
                let r5 = m2[e4].indexOf(t3);
                r5 > -1 && (m2[e4].splice(r5, 1), a3.$off(e4, t3));
              }
              r4 && delete m2[e4], null != (n4 = m2[e4]) && n4.length || (w2.$off(e4, d2), delete m2[e4]);
            }, $once: (t3, r4) => {
              e3(t3, r4, true);
            } });
          }
          let S2 = C(C({}, b2), {}, { bus: f2, query: (function() {
            var e3 = Me(function* (e4, t3) {
              let r4 = (null == e4 ? void 0 : e4.reqid) || (yield b2.genReqId());
              return new Promise((n4, i3) => {
                b2.query(C(C({}, e4), {}, { reqid: r4 }), t3).then((e5) => {
                  "succ" === (null == e5 ? void 0 : e5.result) ? n4(e5) : i3(e5);
                });
              });
            });
            return function(t3, r4) {
              return e3.apply(this, arguments);
            };
          })(), createObservableQuery: (function() {
            var e3 = Me(function* (e4, t3 = {}) {
              let r4 = (null == e4 ? void 0 : e4.reqid) || (yield b2.genReqId()), n4 = new Oe(y2(r4));
              return b2.query(C(C({}, e4), {}, { reqid: r4 }), C(C({}, t3), {}, { observable: true })), n4;
            });
            return function(t3) {
              return e3.apply(this, arguments);
            };
          })() });
          b2 && (window.removeEventListener(A.Message, p2), c2(), n3({ methods: S2, config: r3.data.config }));
        }
      };
      window.addEventListener(A.Message, p2), (() => {
        o2("Child: Handshake - Sending SYN");
        let e3 = { penpal: g.Syn }, r3 = t2 instanceof RegExp ? "*" : t2;
        window.parent.postMessage(e3, r3);
      })(), a2((e3) => {
        window.removeEventListener(A.Message, p2), e3 && u2(e3);
      });
    }), destroy() {
      l2();
    } };
  };
  var $e = "trimjs-extension-host";
  function _e() {
    return "undefined" != typeof crypto && "function" == typeof crypto.randomUUID ? crypto.randomUUID() : `web-ext-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function ke(e2) {
    if (!e2 || "object" != typeof e2) return false;
    const t2 = e2;
    return t2.source === $e && 1 === t2.version && "string" == typeof t2.requestId && ("request" === t2.kind || "response" === t2.kind || "event" === t2.kind);
  }
  function Te(e2) {
    const t2 = /* @__PURE__ */ new Error(`NotSupportedInExtensionHost: ${e2}`);
    throw t2.code = "NotSupportedInExtensionHost", t2;
  }
  function je(e2) {
    var t2;
    const r2 = null !== (t2 = null == e2 ? void 0 : e2.timeoutMs) && void 0 !== t2 ? t2 : 1500, n2 = /* @__PURE__ */ new Map(), i2 = /* @__PURE__ */ new Set(), o2 = (e3) => {
      if (ke(t3 = e3.data) && "response" === t3.kind) {
        const t4 = n2.get(e3.data.requestId);
        if (!t4) return;
        return n2.delete(e3.data.requestId), clearTimeout(t4.timeoutId), void t4.resolve(e3.data);
      }
      var t3;
      (function(e4) {
        return ke(e4) && "event" === e4.kind;
      })(e3.data) && i2.forEach((t4) => {
        t4(e3.data);
      });
    };
    return window.addEventListener("message", o2), { request: (e3, t3, i3) => s(function* () {
      const o3 = (function(e4, t4) {
        return { source: $e, version: 1, kind: "request", requestId: _e(), payload: { method: e4, params: t4 } };
      })(e3, t3), s2 = yield new Promise((t4, s3) => {
        let l3;
        const a3 = i3 && "timeoutMs" in i3 ? i3.timeoutMs : r2;
        "number" == typeof a3 && a3 >= 0 && (l3 = setTimeout(() => {
          n2.delete(o3.requestId), s3(/* @__PURE__ */ new Error(`Extension host timeout while calling ${e3}`));
        }, a3)), n2.set(o3.requestId, { resolve: t4, reject: s3, timeoutId: l3 }), window.postMessage(o3, "*");
      });
      var l2, a2;
      if (!s2.payload.ok) throw new Error(null !== (l2 = null === (a2 = s2.payload.error) || void 0 === a2 ? void 0 : a2.message) && void 0 !== l2 ? l2 : `Extension host request failed: ${e3}`);
      return s2.payload.result;
    })(), onEvent: (e3) => (i2.add(e3), () => {
      i2.delete(e3);
    }), destroy() {
      window.removeEventListener("message", o2), n2.forEach((e3) => {
        clearTimeout(e3.timeoutId), e3.reject(/* @__PURE__ */ new Error("Extension bridge destroyed"));
      }), n2.clear(), i2.clear();
    } };
  }
  function Ne() {
    return (Ne = s(function* (e2) {
      const t2 = je();
      try {
        var r2;
        const i2 = yield t2.request("handshake", { debug: null !== (r2 = null == e2 ? void 0 : e2.debug) && void 0 !== r2 && r2 }, { timeoutMs: 5e3 });
        return n.log("Extension host probe response:", i2), true === i2.available;
      } catch (i2) {
        return n.log("Extension host probe failed:", i2), false;
      } finally {
        t2.destroy();
      }
    })).apply(this, arguments);
  }
  function We() {
    return We = s(function* () {
      const e2 = je(), t2 = /* @__PURE__ */ new Map();
      e2.onEvent((e3) => {
        const r3 = t2.get(e3.payload.event);
        null == r3 || r3.forEach((t3) => {
          t3(e3.payload.data);
        });
      }), yield e2.request("handshake", {}, { timeoutMs: 5e3 });
      const r2 = yield e2.request("getPlatformConfig", {}), n2 = { bus: { $on(r3, n3) {
        var i3;
        const o3 = null !== (i3 = t2.get(r3)) && void 0 !== i3 ? i3 : /* @__PURE__ */ new Set(), s2 = 0 === o3.size;
        o3.add(n3), t2.set(r3, o3), s2 && e2.request("subscribe", { event: r3 });
      }, $off(r3, n3) {
        const i3 = t2.get(r3);
        i3 && (i3.delete(n3), 0 === i3.size && (t2.delete(r3), e2.request("unsubscribe", { event: r3 })));
      }, $once(e3, t3) {
        const r3 = function() {
          n2.bus.$off(e3, r3), t3(...arguments);
        };
        n2.bus.$on(e3, r3);
      }, $emit() {
        Te("bus.$emit");
      } }, genReqId: () => _e(), query: (t3, r3) => e2.request("query", { params: t3, config: r3 }), createObservableQuery: (o2 = s(function* () {
        return Te("createObservableQuery");
      }), function() {
        return o2.apply(this, arguments);
      }), openApp: () => Te("openApp"), openAppSetting: () => Te("openAppSetting"), openCustomApp: () => Te("openCustomApp"), setTitle: () => Te("setTitle"), pickFile: (t3) => e2.request("pickFile", t3, { timeoutMs: null }), pickUserFile: () => Te("pickUserFile"), pickSharedFile: () => Te("pickSharedFile"), showFileDetails: (e3, t3) => Te("showFileDetails"), authorizeUserFile: (e3) => Te("authorizeUserFile"), authorizeSharedFile: (e3) => Te("authorizeSharedFile"), close: (i2 = s(function* () {
        e2.destroy();
      }), function() {
        return i2.apply(this, arguments);
      }), refreshToken: () => e2.request("refreshToken", {}), setExitPageTips: () => Te("setExitPageTips"), openFileManagerApp: () => Te("openFileManagerApp"), openFileManager: () => Te("openFileManager"), openFile: () => Te("openFile"), getPlatformConfig: () => Promise.resolve(r2), getHostSnapshot: () => e2.request("getHostSnapshot", {}) };
      var i2, o2, l2;
      return { methods: n2, config: (l2 = r2, { appName: "extension-host", os: { version: l2.systemVersion, theme: l2.theme, language: l2.language, format: { date: { date: l2.format.date, time: l2.format.time } } } }) };
    }), We.apply(this, arguments);
  }
  var Ce = null;
  function qe() {
    return (qe = s(function* (e2) {
      const t2 = Fe({ callTimeouts: { getSessionCredentials: 5e3 }, debug: null == e2 ? void 0 : e2.debug, timeout: 1500 });
      try {
        const e3 = yield t2.promise;
        return e3;
      } catch (r2) {
        return t2.destroy(), n.log("Native OS connection probe failed:", r2), null;
      }
    })).apply(this, arguments);
  }
  var xe = (e2) => Ce || (Ce = s(function* () {
    if ("undefined" != typeof window && window.parent !== window) {
      const t2 = yield (function(e3) {
        return qe.apply(this, arguments);
      })(e2);
      if (t2) return t2;
    }
    return (yield (function(e3) {
      return Ne.apply(this, arguments);
    })(e2)) ? (function() {
      return We.apply(this, arguments);
    })() : Fe({ callTimeouts: { getSessionCredentials: 5e3 }, debug: null == e2 ? void 0 : e2.debug }).promise;
  })());
  var Ie = { pickFile: "pick-file", pickUserFile: "pick-user-file", pickSharedFile: "pick-shared-file", authorizeUserFile: "authorize-user-file", authorizeSharedFile: "authorize-shared-file" };
  var Ue = class {
    constructor() {
      r(this, "options", void 0), r(this, "flutterInAppWebView", null), r(this, "osConnector", null), r(this, "initPromise", void 0), r(this, "appApiVersion", void 0), r(this, "isWeb", true), r(this, "isStandaloneWeb", false);
      let e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      this.options = e2, e2.debug && (n.setDebug(true), n.log("Trim App initialized with debug mode")), n.log("Options:", e2), this.initPromise = this.init();
    }
    init() {
      var e2 = this;
      return s(function* () {
        return n.log("Starting initialization..."), new Promise((t2) => {
          if (i()) e2.isWeb = false, n.log("Initializing mobile platform..."), new Promise((e3) => {
            var t3;
            (c ? window.flutter_inappwebview : u || (null === (t3 = window.flutter_inappwebview) || void 0 === t3 ? void 0 : t3._platformReady)) ? (n.log("flutter_inappwebview is ready"), e3(window.flutter_inappwebview)) : window.addEventListener("flutterInAppWebViewPlatformReady", () => {
              n.log("flutter_inappwebview is ready"), e3(window.flutter_inappwebview);
            });
          }).then((r2 = s(function* (r3) {
            yield e2.initMobileAppApi(r3), n.log("Mobile platform initialized"), t2();
          }), function(e3) {
            return r2.apply(this, arguments);
          }));
          else {
            if (e2.isWeb = true, e2.isStandaloneWeb = "undefined" != typeof window && window.parent === window, e2.isStandaloneWeb) return n.log("Standalone web platform detected; host bridge initialization skipped"), void t2();
            n.log("Initializing web platform..."), xe().then((r3) => {
              e2.osConnector = r3, n.log("Web platform initialized"), t2();
            });
          }
          var r2;
        });
      })();
    }
    getWebMethods() {
      var e2;
      const t2 = null === (e2 = this.osConnector) || void 0 === e2 ? void 0 : e2.methods;
      if (!t2) throw new Error("Host bridge is not available outside iframe or app runtime");
      return t2;
    }
    loadAppMessage() {
      var e2 = this;
      return s(function* () {
        return e2.callAppMethod("getAppMessage");
      })();
    }
    initMobileAppApi(e2) {
      var t2 = this;
      return s(function* () {
        t2.flutterInAppWebView = e2;
        try {
          const e3 = yield t2.loadAppMessage();
          t2.appApiVersion = null == e3 ? void 0 : e3.appApi;
        } catch (r2) {
          n.log("Failed to load mobile appApi version:", r2), t2.appApiVersion = void 0;
        }
      })();
    }
    assertMobileAppApi(e2) {
      let t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "v1.0";
      if (!this.isAtLeastVersion(this.appApiVersion, t2)) throw new Error(`${e2} requires appApi >= ${t2}`);
    }
    isAtLeastVersion(e2, t2) {
      if (!e2) return false;
      const r2 = this.parseVersion(e2), n2 = this.parseVersion(t2), i2 = Math.max(r2.length, n2.length);
      for (let l2 = 0; l2 < i2; l2 += 1) {
        var o2, s2;
        const e3 = null !== (o2 = r2[l2]) && void 0 !== o2 ? o2 : 0, t3 = null !== (s2 = n2[l2]) && void 0 !== s2 ? s2 : 0;
        if (e3 > t3) return true;
        if (e3 < t3) return false;
      }
      return true;
    }
    parseVersion(e2) {
      return e2.replace(/^v/i, "").split(".").map((e3) => Number.parseInt(e3, 10) || 0);
    }
    callAppMethod(e2) {
      var t2 = arguments, r2 = this;
      return s(function* () {
        if (!r2.flutterInAppWebView) return null;
        for (var n2 = t2.length, i2 = new Array(n2 > 1 ? n2 - 1 : 0), o2 = 1; o2 < n2; o2++) i2[o2 - 1] = t2[o2];
        return p(r2.flutterInAppWebView, e2, ...i2);
      })();
    }
    ready() {
      var e2 = this;
      return s(function* () {
        return e2.initPromise;
      })();
    }
    getHostCapabilities() {
      var e2 = this;
      return s(function* () {
        var t2;
        let r2;
        try {
          yield Promise.race([e2.initPromise, new Promise((e3, t3) => {
            r2 = setTimeout(() => t3(/* @__PURE__ */ new Error("Host connection unavailable")), 5e3);
          })]);
        } finally {
          void 0 !== r2 && clearTimeout(r2);
        }
        if (!e2.isWeb) return { runtime: "mobile" };
        const n2 = null === (t2 = e2.osConnector) || void 0 === t2 || null === (t2 = t2.config) || void 0 === t2 ? void 0 : t2.host;
        return "desktop" === (null == n2 ? void 0 : n2.runtime) ? a({ runtime: "desktop" }, 1 === n2.sessionCredentials ? { sessionCredentials: 1 } : {}) : { runtime: "web" === (null == n2 ? void 0 : n2.runtime) ? "web" : "unknown" };
      })();
    }
    getSessionCredentials() {
      var e2 = this;
      return s(function* () {
        const t2 = (e3) => ({ code: 1, msg: e3, error: e3, data: null });
        try {
          var r2, n2;
          const i2 = yield e2.getHostCapabilities(), o2 = null === (r2 = e2.osConnector) || void 0 === r2 ? void 0 : r2.methods.getSessionCredentials;
          if ("desktop" !== i2.runtime || 1 !== i2.sessionCredentials || !o2) return t2("NOT_SUPPORTED");
          const s2 = yield o2();
          return 0 === (null == s2 ? void 0 : s2.code) && "string" == typeof (null === (n2 = s2.data) || void 0 === n2 ? void 0 : n2.secret) && s2.data.secret ? { code: 0, msg: "", data: a({ secret: s2.data.secret }, "string" == typeof s2.data.token && s2.data.token ? { token: s2.data.token } : {}) } : 1 === (null == s2 ? void 0 : s2.code) && ["NOT_SUPPORTED", "FORBIDDEN", "SESSION_UNAVAILABLE", "CONNECTION_CLOSED"].includes(s2.error) ? t2(s2.error) : t2("SESSION_UNAVAILABLE");
        } catch (i2) {
          return t2("CONNECTION_CLOSED");
        }
      })();
    }
    getOptions() {
      return this.options;
    }
    setOptions(e2) {
      this.options = a(a({}, this.options), e2), void 0 !== e2.debug && n.setDebug(e2.debug), n.log("Options updated:", this.options);
    }
    getPlatformConfig() {
      var e2 = this;
      return s(function* () {
        if (yield e2.initPromise, e2.isWeb) {
          const t3 = yield e2.getWebMethods().getPlatformConfig();
          if (!t3) throw new Error("Failed to get platform config");
          return t3;
        }
        if (e2.appApiVersion) {
          const t3 = yield e2.callAppMethod("getPlatformConfig");
          if (!t3) throw new Error("Failed to get platform config");
          return t3;
        }
        const t2 = yield e2.loadAppMessage();
        if (!t2) throw new Error("Failed to get platform config");
        return e2.appApiVersion = t2.appApi, { theme: t2.nightMode, language: t2.language, appVersion: t2.appVersion, systemVersion: t2.systemVersion, format: { date: t2.dateFormat, time: t2.timeFormat } };
      })();
    }
    getHostSnapshot() {
      var e2 = this;
      return s(function* () {
        if (yield e2.initPromise, !e2.isWeb) throw new Error("getHostSnapshot is not supported on mobile platform");
        const t2 = yield e2.getWebMethods().getHostSnapshot();
        if (!t2) throw new Error("Failed to get host snapshot");
        return t2;
      })();
    }
    getAppAuthBaseUrl() {
      var e2 = this;
      return s(function* () {
        if ("undefined" != typeof window && window.parent !== window) {
          const e3 = document.referrer;
          if (e3) try {
            return new URL(e3).origin;
          } catch (t2) {
            n.log("Failed to derive app auth base url from document.referrer:", t2);
          }
        }
        if ("undefined" != typeof window) return window.location.origin;
        if (yield e2.initPromise, e2.isWeb) try {
          const t2 = yield e2.getHostSnapshot();
          if (t2.host) return t2.host;
        } catch (t2) {
          n.log("Failed to derive app auth host snapshot:", t2);
        }
        throw new Error("Failed to derive app auth base url");
      })();
    }
    buildAppAuthUrl(e2, t2) {
      var r2 = this;
      return s(function* () {
        return (function(e3, t3, r3, n2) {
          var i2, o2;
          const s2 = new URL(e3, null !== (i2 = null != n2 ? n2 : null === (o2 = globalThis.location) || void 0 === o2 ? void 0 : o2.origin) && void 0 !== i2 ? i2 : "http://localhost"), l2 = Ie[t3];
          if (s2.pathname = (function(e4) {
            return `/app-auth/${e4}`;
          })(l2), s2.searchParams.set("appName", r3.appName), r3.redirectUri && s2.searchParams.set("redirectUri", r3.redirectUri), r3.state && s2.searchParams.set("state", r3.state), "pickFile" === t3 || "pickUserFile" === t3 || "pickSharedFile" === t3) {
            var a2;
            const e4 = r3;
            "pickSharedFile" !== t3 && e4.directory && s2.searchParams.set("directory", "true");
            const n3 = "pickSharedFile" !== t3 ? e4.accept : void 0;
            (null == n3 ? void 0 : n3.length) && s2.searchParams.set("accept", n3.join(",")), (null === (a2 = e4.sidebarGroup) || void 0 === a2 ? void 0 : a2.length) && s2.searchParams.set("sidebarGroup", e4.sidebarGroup.join(","));
          } else s2.searchParams.set("path", r3.path);
          return s2.toString();
        })(yield r2.getAppAuthBaseUrl(), e2, t2, window.location.origin);
      })();
    }
    openAppAuth(e2, t2, r2) {
      var n2 = this;
      return s(function* () {
        if (yield n2.initPromise, !n2.isWeb) throw new Error("openAppAuth is not supported on mobile platform");
        const i2 = yield n2.buildAppAuthUrl(e2, t2);
        return "_self" === (null == r2 ? void 0 : r2.target) && "undefined" != typeof window ? (window.location.assign(i2), i2) : (yield n2.openURL(i2, null == r2 ? void 0 : r2.target, null == r2 ? void 0 : r2.features), i2);
      })();
    }
    parseAppAuthCallback(e2) {
      return (function(e3) {
        var t2, r2, n2, i2;
        const o2 = e3 instanceof URLSearchParams ? e3 : e3 instanceof URL ? e3.searchParams : "string" == typeof e3 ? new URL(e3, null !== (t2 = null === (r2 = globalThis.location) || void 0 === r2 ? void 0 : r2.origin) && void 0 !== t2 ? t2 : "http://localhost").searchParams : new URLSearchParams(null !== (n2 = null === (i2 = globalThis.location) || void 0 === i2 ? void 0 : i2.search) && void 0 !== n2 ? n2 : ""), s2 = o2.get("method"), l2 = s2 && Object.prototype.hasOwnProperty.call(Ie, s2) ? s2 : void 0, a2 = o2.get("path");
        let u2;
        if (a2) try {
          const e4 = JSON.parse(a2);
          Array.isArray(e4) && e4.every((e5) => "string" == typeof e5) && (u2 = e4);
        } catch (c2) {
          u2 = void 0;
        }
        return { status: o2.get("status") || void 0, error: o2.get("error") || void 0, method: l2, appName: o2.get("appName") || void 0, state: o2.get("state") || void 0, path: u2 };
      })(e2);
    }
    setTitle(e2) {
      var t2 = this;
      return s(function* () {
        if (yield t2.initPromise, n.log("Setting title:", e2), document.title = e2, t2.isWeb) return t2.getWebMethods().setTitle(e2);
      })();
    }
    setExitPageTips(e2) {
      var t2 = this;
      return s(function* () {
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().setExitPageTips(e2) : t2.callAppMethod("setExitPageTips", e2 ? JSON.stringify(e2) : "");
      })();
    }
    openFile(e2) {
      var t2 = this;
      return s(function* () {
        return yield t2.initPromise, n.log("Opening file:", e2), t2.isWeb ? t2.getWebMethods().openFile(e2) : t2.callAppMethod("openFile", e2);
      })();
    }
    openFileManager(e2) {
      var t2 = this;
      return s(function* () {
        if (yield t2.initPromise, n.log("Opening file manager:", e2), t2.isWeb) {
          const r2 = t2.getWebMethods();
          return (r2.openFileManager || r2.openFileManagerApp)(e2);
        }
        return t2.assertMobileAppApi("openFileManager"), t2.callAppMethod("openFileManager", e2);
      })();
    }
    showFileDetails(e2, t2) {
      var r2 = this;
      return s(function* () {
        return yield r2.initPromise, r2.isWeb ? r2.getWebMethods().showFileDetails(e2, t2) : (r2.assertMobileAppApi("showFileDetails"), r2.callAppMethod("showFileDetails", JSON.stringify({ paths: e2, options: t2 })));
      })();
    }
    authorizeUserFile(e2) {
      var t2 = this;
      return s(function* () {
        var r2;
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().authorizeUserFile(e2) : (t2.assertMobileAppApi("authorizeUserFile"), null !== (r2 = yield t2.callAppMethod("authorizeUserFile", JSON.stringify({ path: e2 }))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
    authorizeSharedFile(e2) {
      var t2 = this;
      return s(function* () {
        var r2;
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().authorizeSharedFile(e2) : (t2.assertMobileAppApi("authorizeSharedFile"), null !== (r2 = yield t2.callAppMethod("authorizeSharedFile", JSON.stringify({ path: e2 }))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
    openAppSetting() {
      var e2 = this;
      return s(function* () {
        return yield e2.initPromise, n.log("Opening app setting"), e2.isWeb ? e2.getWebMethods().openAppSetting() : (e2.assertMobileAppApi("openAppSetting"), e2.callAppMethod("openAppSetting"));
      })();
    }
    openApp(e2) {
      var t2 = this;
      return s(function* () {
        return yield t2.initPromise, n.log("Opening app:", e2), t2.isWeb ? t2.getWebMethods().openApp(e2) : !!i() && t2.callAppMethod("openAppPage", e2);
      })();
    }
    openCustomApp(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, n.log("Opening custom app:", e2, t2), r2.isWeb) return r2.getWebMethods().openCustomApp(e2, t2);
        throw new Error("openCustomApp is not supported on mobile platform");
      })();
    }
    openURL(e2, t2, r2) {
      var i2 = this;
      return s(function* () {
        if (yield i2.initPromise, n.log("Opening URL:", e2, t2, r2), !i2.isWeb) return i2.callAppMethod("openSystemBrowser", e2);
        if ("_self" === t2) return void window.location.assign(e2);
        if (!r2) return void window.open(e2, t2, r2);
        const o2 = window.open("", t2, r2);
        o2 && (o2.location.href = e2);
      })();
    }
    close() {
      var e2 = this;
      return s(function* () {
        return yield e2.initPromise, e2.isWeb ? e2.getWebMethods().close() : e2.callAppMethod("exitPage");
      })();
    }
    query(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, r2.isWeb) {
          if (null == t2 ? void 0 : t2.observable) return r2.getWebMethods().createObservableQuery(e2, t2);
          const n3 = yield r2.getWebMethods().query(e2, t2);
          if (!n3) throw new Error("Failed to query");
          return n3;
        }
        if (r2.assertMobileAppApi("query"), null == t2 ? void 0 : t2.observable) {
          if (!r2.flutterInAppWebView) throw new Error("Failed to start observable query");
          return (function(e3, t3, r3) {
            return v(), new f((n3) => {
              let i2, o2 = false;
              return p(e3, "wsQuery", null == t3 ? void 0 : t3.req, JSON.stringify(t3), void 0 === r3 ? void 0 : JSON.stringify(r3)).then((e4) => {
                (null == e4 ? void 0 : e4.reqId) ? (i2 = e4.reqId, o2 || h.set(i2, n3)) : n3.error(/* @__PURE__ */ new Error("Failed to start observable query"));
              }, (e4) => {
                n3.error(e4);
              }), () => {
                o2 = true, i2 && h.delete(i2);
              };
            });
          })(r2.flutterInAppWebView, e2, t2);
        }
        const n2 = yield r2.callAppMethod("wsQuery", null == e2 ? void 0 : e2.req, JSON.stringify(e2), void 0 === t2 ? void 0 : JSON.stringify(t2));
        if (!n2) throw new Error("Failed to query");
        if ("succ" !== n2.result) throw n2;
        return n2;
      })();
    }
    refreshToken() {
      var e2 = this;
      return s(function* () {
        if (yield e2.initPromise, !e2.isWeb) throw new Error("refreshToken is not supported on mobile platform");
        return e2.getWebMethods().refreshToken();
      })();
    }
    $on(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, !r2.isWeb) throw new Error("$on is not supported on mobile platform");
        const n2 = r2.getWebMethods().bus;
        if (!n2) throw new Error("bus is not available");
        n2.$on(e2, t2);
      })();
    }
    $off(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, !r2.isWeb) throw new Error("$off is not supported on mobile platform");
        const n2 = r2.getWebMethods().bus;
        if (!n2) throw new Error("bus is not available");
        n2.$off(e2, t2);
      })();
    }
    $once(e2, t2) {
      var r2 = this;
      return s(function* () {
        if (yield r2.initPromise, !r2.isWeb) throw new Error("$once is not supported on mobile platform");
        const n2 = r2.getWebMethods().bus;
        if (!n2) throw new Error("bus is not available");
        n2.$once(e2, t2);
      })();
    }
    pickFile(e2) {
      var t2 = this;
      return s(function* () {
        var r2, n2;
        return yield t2.initPromise, t2.isWeb ? null === (r2 = t2.osConnector) || void 0 === r2 ? void 0 : r2.methods.pickFile(e2) : t2.isAtLeastVersion(t2.appApiVersion, "v1.0") ? null !== (n2 = yield t2.callAppMethod("pickFile", JSON.stringify(e2))) && void 0 !== n2 ? n2 : void 0 : t2.flutterInAppWebView ? (function(e3, t3) {
          return y.apply(this, arguments);
        })(t2.flutterInAppWebView, e2) : void 0;
      })();
    }
    pickUserFile() {
      var e2 = arguments, t2 = this;
      return s(function* () {
        var r2;
        let n2 = e2.length > 0 && void 0 !== e2[0] ? e2[0] : {};
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().pickUserFile(n2) : (t2.assertMobileAppApi("pickUserFile"), null !== (r2 = yield t2.callAppMethod("pickUserFile", JSON.stringify(n2))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
    pickSharedFile() {
      var e2 = arguments, t2 = this;
      return s(function* () {
        var r2;
        let n2 = e2.length > 0 && void 0 !== e2[0] ? e2[0] : {};
        return yield t2.initPromise, t2.isWeb ? t2.getWebMethods().pickSharedFile(n2) : (t2.assertMobileAppApi("pickSharedFile"), null !== (r2 = yield t2.callAppMethod("pickSharedFile", JSON.stringify(n2))) && void 0 !== r2 ? r2 : void 0);
      })();
    }
  };

  // fnos/web/bridge.js
  var PREFIX = "/app/qingye";
  var MARKER = "X-Qingye-Request";
  var hostCache;
  function host() {
    if (hostCache === void 0) {
      try {
        hostCache = new Ue({});
      } catch (error) {
        hostCache = null;
        if (window.console) console.warn("[轻页] 飞牛宿主接口不可用：" + error.message);
      }
    }
    return hostCache;
  }
  function failure(payload, status) {
    const error = new Error(payload?.error || `请求失败（HTTP ${status}）`);
    error.status = status;
    error.code = payload?.code || null;
    error.hints = Array.isArray(payload?.hints) ? payload.hints.filter((hint) => typeof hint === "string" && hint.trim()) : [];
    return error;
  }
  async function parse(response) {
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text.slice(0, 300) || `请求失败（HTTP ${response.status}）` };
      }
    }
    if (!response.ok || payload.error) throw failure(payload, response.status);
    return payload;
  }
  async function request(route, body) {
    const url = `${PREFIX}/api/${route}`;
    const init = body === void 0 ? { method: "GET", headers: {} } : { method: "POST", headers: { "Content-Type": "application/json", [MARKER]: "1" }, body: JSON.stringify(body) };
    return parse(await fetch(url, init));
  }
  async function postRaw(route, blob) {
    const response = await fetch(`${PREFIX}/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", [MARKER]: "1" },
      body: blob
    });
    return parse(response);
  }
  function query(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== void 0 && value !== null && value !== "") search.set(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : "";
  }
  async function uploadOne(file, operation, onProgress) {
    const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 40);
    let started = false;
    try {
      const session = await request("upload-start", { id, operation, name: file.name, size: file.size });
      started = true;
      const chunkSize = Number(session.chunkSize) || 512 * 1024;
      for (let offset = 0; offset < file.size; offset += chunkSize) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const data = await postRaw(`upload-chunk?id=${encodeURIComponent(id)}`, chunk);
        const percent = Math.min(100, Math.floor((Number(data.received) || offset + chunk.size) / file.size * 100));
        onProgress?.(`正在上传 ${file.name}… ${percent}%`, percent);
      }
      onProgress?.(`文件已收到，正在保存 ${file.name}…`, 100);
      return await request("upload-finish", { id });
    } catch (error) {
      if (started) request("upload-cancel", { id }).catch(() => {
      });
      throw error;
    }
  }
  async function upload(files, operation, options = {}) {
    if (!files?.length) return { added: [], errors: [] };
    if (files.length > 100) throw new Error("每批最多上传 100 个文件");
    const added = [];
    const errors = [];
    for (const file of files) {
      try {
        const data = await uploadOne(file, operation, options.onProgress);
        added.push(...data.added || []);
      } catch (error) {
        errors.push(`${file.name}：${error.message}`);
        if (Array.isArray(error.hints)) options.onHints?.(error.hints);
      }
    }
    return { added, errors };
  }
  var active = null;
  var timer = null;
  var listeners = /* @__PURE__ */ new Set();
  function emit(job) {
    active = job;
    for (const listener of listeners) {
      try {
        listener(job);
      } catch (error) {
        if (window.console) console.error(error);
      }
    }
  }
  async function poll() {
    if (!active) return;
    try {
      emit(await request(`job?id=${encodeURIComponent(active.id)}`));
      if (active.status === "running") timer = setTimeout(poll, 700);
    } catch (error) {
      timer = setTimeout(poll, 3e3);
      for (const listener of listeners) {
        try {
          listener({ ...active, pollError: error.message });
        } catch {
        }
      }
    }
  }
  async function openAppSetting() {
    const instance = host();
    if (!instance) throw new Error("当前页面不在飞牛桌面中，请从飞牛桌面打开轻页");
    if (instance.isStandaloneWeb) throw new Error("当前页面不在飞牛桌面中，请从飞牛桌面打开轻页");
    await instance.openAppSetting();
  }
  async function authorizeFolder(path) {
    const instance = host();
    if (!instance) throw new Error("当前页面不在飞牛桌面中，请从飞牛桌面打开轻页后再授权目录");
    if (instance.isStandaloneWeb) throw new Error("当前页面不在飞牛桌面中，请从飞牛桌面打开轻页后再授权目录");
    if (!path) throw new Error("请先进入要授权的文件夹");
    const result = await instance.authorizeSharedFile(path);
    if (!result) throw new Error("已取消授权");
    if (result.code !== 0) throw new Error(result.msg || "授权未完成");
    const paths = Array.isArray(result.data) ? result.data : [];
    return { code: result.code, msg: result.msg || "", paths };
  }
  async function openFileManager(target) {
    const instance = host();
    if (!instance) throw new Error("当前页面不在飞牛桌面中，请从飞牛桌面打开轻页");
    if (instance.isStandaloneWeb) throw new Error("当前页面不在飞牛桌面中，请从飞牛桌面打开轻页");
    if (!target) throw new Error("没有可打开的路径");
    if (typeof instance.openFileManager !== "function") throw new Error("当前飞牛版本不支持从页面打开文件管理器，请手动打开「文件管理器」定位该路径");
    await instance.openFileManager(target);
  }
  function hostState() {
    const instance = host();
    if (!instance) return { available: false, standalone: true };
    return { available: true, standalone: Boolean(instance.isStandaloneWeb) };
  }
  window.qingye = {
    settings: () => request("settings"),
    list: (path, operation) => request(`nas/list${query({ path, operation })}`),
    select: (paths, operation) => request("nas/select", { paths, operation }),
    folder: (folder, operation) => request("nas/folder", { folder, operation }),
    permission: (path, mode = "r") => request("nas/permission", { path, mode }),
    grant: (path) => request("nas/grant", { path }),
    authorizeFolder,
    openFileManager,
    hostState,
    upload,
    start: async (payload) => {
      clearTimeout(timer);
      const started = await request("jobs", payload);
      active = { id: started.jobId, status: "running", percent: 0, stage: "已提交" };
      timer = setTimeout(poll, 150);
      return started;
    },
    status: (id) => request(`job?id=${encodeURIComponent(id)}`),
    cancel: (id) => {
      clearTimeout(timer);
      return request("cancel", { id });
    },
    history: () => request("history"),
    retry: (id) => request("retry", { id }),
    onEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    downloadUrl: (id, path) => `${PREFIX}/api/download${query({ id, path })}`,
    openAppSetting
  };

  // src/catalog.mjs
  var OPERATIONS = {
    pdf_compress: { label: "PDF 压缩", group: "pdf", extensions: ["pdf"] },
    pdf_merge: { label: "合并 PDF", group: "pdf", extensions: ["pdf"], combined: true },
    pdf_split: { label: "提取 PDF 页面", group: "pdf", extensions: ["pdf"] },
    pdf_to_images: { label: "PDF 转图片", group: "pdf", extensions: ["pdf"] },
    images_to_pdf: { label: "图片合并为 PDF", group: "pdf", extensions: ["jpg", "jpeg", "png", "webp"], combined: true },
    image_convert: { label: "图片转换 / 压缩", group: "image", extensions: ["jpg", "jpeg", "png", "webp"] },
    office_to_pdf: { label: "Word / Excel / PPT 转 PDF", group: "office", extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx"], component: "office" },
    audio_convert: { label: "音频转换 / 提取音频", group: "audio", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "mp4", "mov", "mkv", "avi", "webm"], component: "media" },
    video_convert: { label: "视频转 MP4 / 压缩", group: "video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"], component: "media" }
  };
  function validateOptions(operation, raw = {}) {
    if (!OPERATIONS[operation]) throw new Error("不支持的操作");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("参数格式错误");
    const preset = raw.preset ?? "balanced";
    if (!["clear", "balanced", "small"].includes(preset)) throw new Error("无效的质量档位");
    const result = { preset };
    if (operation === "pdf_compress" && raw.targetMB !== void 0) {
      if (typeof raw.targetMB !== "number" || !Number.isFinite(raw.targetMB) || raw.targetMB < 0.1 || raw.targetMB > 500) throw new Error("目标大小需为 0.1–500 MB");
      result.targetMB = raw.targetMB;
    }
    if (operation === "image_convert") {
      result.format = raw.format ?? "jpg";
      if (!["jpg", "png", "webp"].includes(result.format)) throw new Error("图片格式需为 jpg、png 或 webp");
    }
    if (operation === "pdf_to_images") {
      result.format = raw.format ?? "png";
      if (!["jpg", "png"].includes(result.format)) throw new Error("PDF 导出图片格式需为 jpg 或 png");
    }
    if (["image_convert", "pdf_to_images"].includes(operation)) {
      result.maxDimension = raw.maxDimension ?? 2600;
      if (!Number.isInteger(result.maxDimension) || result.maxDimension < 64 || result.maxDimension > 8e3) throw new Error("图片最长边需为 64–8000 像素");
    }
    if (operation === "pdf_split") {
      result.pages = raw.pages;
      if (typeof result.pages !== "string" || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(result.pages) || result.pages.length > 1e3) throw new Error("请输入页码，例如 1-3,5");
    }
    if (operation === "audio_convert") {
      result.format = raw.format ?? "mp3";
      if (!["mp3", "wav", "flac", "m4a"].includes(result.format)) throw new Error("不支持的音频输出格式");
    }
    if (operation === "video_convert") {
      result.maxHeight = raw.maxHeight ?? 1080;
      if (![480, 720, 1080, 2160].includes(result.maxHeight)) throw new Error("视频高度需为 480、720、1080 或 2160");
      result.hw = raw.hw ?? "auto";
      if (!["auto", "off"].includes(result.hw)) throw new Error("硬件加速选项需为 auto（自动）或 off（关闭）");
    }
    return result;
  }

  // fnos/web/app.mjs
  var $2 = (id) => document.getElementById(id);
  var api = window.qingye;
  var GROUPS = {
    pdf: { label: "PDF 工具", subtitle: "压缩、合并与格式转换，保留你的原文件。" },
    office: { label: "办公文档", subtitle: "Word / Excel / PPT 转 PDF，排版以本机字体为准。" },
    image: { label: "图片处理", subtitle: "格式转换与尺寸压缩，批量处理更省事。" },
    audio: { label: "音频转换", subtitle: "转换格式或从视频中提取音轨。" },
    video: { label: "视频转换", subtitle: "统一转成 MP4 或按高度压缩。" },
    settings: { label: "组件与目录", subtitle: "查看授权目录、转换组件与任务历史。" }
  };
  var PRESET_HIDDEN = ["pdf_merge", "pdf_split", "images_to_pdf", "office_to_pdf"];
  var MAX_FILES = 100;
  var state = {
    group: "pdf",
    operation: "pdf_compress",
    files: [],
    outputDir: null,
    settings: null,
    job: null,
    busy: false,
    uploading: false,
    history: []
  };
  var pad = (n2) => String(n2).padStart(2, "0");
  function formatSize(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "大小未知";
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    return `${(value / 1024 ** 3).toFixed(2)} GB`;
  }
  function formatTime(value) {
    if (!value) return "时间未知";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未知";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function formatMoment(ms) {
    if (!ms) return "时间未知";
    const date = new Date(Number(ms));
    if (Number.isNaN(date.getTime())) return "时间未知";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  var baseName = (p2) => String(p2 || "").split(/[\\/]/).filter(Boolean).pop() || String(p2 || "");
  var dirName = (p2) => {
    const text = String(p2 || "");
    const index = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
    return index > 0 ? text.slice(0, index) : "";
  };
  var extOf = (name) => {
    const text = String(name || "");
    const index = text.lastIndexOf(".");
    return index > 0 ? text.slice(index + 1).toUpperCase() : "FILE";
  };
  function firstNumber(...values) {
    for (const value of values) {
      if (value === void 0 || value === null || value === "") continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }
  function countPairs(value, keyName) {
    const out = [];
    const push = (key, count) => {
      if (key === void 0 || key === null || key === "") return;
      const number = Number(count);
      out.push({ key: String(key), count: Number.isFinite(number) ? number : null });
    };
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          push(item, null);
          continue;
        }
        if (Array.isArray(item)) {
          push(item[0], item[1]);
          continue;
        }
        if (item && typeof item === "object") {
          push(item[keyName] ?? item.mode ?? item.owner ?? item.name ?? item.key ?? item.value, item.count ?? item.n ?? item.total);
        }
      }
      return out;
    }
    if (value && typeof value === "object") {
      for (const [key, count] of Object.entries(value)) push(key, count);
    }
    return out;
  }
  var formatPairs = (pairs) => pairs.map(({ key, count }) => count === null ? key : `${key} × ${count}`).join("、");
  function relativeTo(root, target) {
    const base = String(root || "").replace(/[\\/]+$/, "");
    const text = String(target || "");
    if (!base || !text.startsWith(base)) return "";
    const rest = text.slice(base.length).replace(/^[\\/]+/, "");
    return rest.split(/[\\/]+/).filter(Boolean).join("/");
  }
  function relativePath(path) {
    const roots = [...state.settings?.roots || []].map((root) => typeof root === "string" ? root : root.path).filter(Boolean);
    let best = null;
    for (const root of roots) {
      const rest = relativeTo(root, path);
      if (rest && (!best || root.length > best.root.length)) best = { root, rest };
    }
    return best ? best.rest : String(path || "");
  }
  function operationExtensions(operation) {
    return OPERATIONS[operation]?.extensions || [];
  }
  function setMessage(text, kind = "") {
    const node = $2("message");
    node.textContent = text || "";
    node.classList.toggle("is-error", kind === "error");
    node.classList.toggle("is-info", kind === "info");
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function applySettings(settings) {
    state.settings = settings;
    const version = [settings?.label, settings?.version].filter(Boolean).join(" ") || "飞牛独立版 1.2.13.5";
    $2("version-badge").textContent = version;
    $2("sidebar-version").textContent = version;
    renderFolder();
  }
  async function ensureSettings() {
    if (state.settings) return state.settings;
    try {
      const settings = await api.settings();
      applySettings(settings);
      return settings;
    } catch (error) {
      setMessage(`读取应用信息失败：${error.message}`, "error");
      return null;
    }
  }
  function addFiles(items = [], extra = {}) {
    let added = 0;
    const overflow = [];
    for (const item of items) {
      if (!item?.path) continue;
      if (state.files.some((file) => file.path === item.path)) continue;
      if (state.files.length >= MAX_FILES) {
        overflow.push(item.name || baseName(item.path));
        continue;
      }
      state.files.push({
        path: item.path,
        name: item.name || baseName(item.path),
        size: item.size,
        mtime: item.mtime || null,
        source: extra.source || "nas"
      });
      added += 1;
    }
    return { added, overflow };
  }
  function mergeResult(result, extra = {}) {
    if (!result) return;
    const { added, overflow } = addFiles(result.added || [], extra);
    const errors = [...result.errors || []];
    if (overflow.length) errors.push(`列表一次最多 ${MAX_FILES} 个文件，${overflow.length} 个未加入，请分批处理`);
    state.job = null;
    render();
    if (errors.length) setMessage(errors.join("\n"), "error");
    else if (added) setMessage("", "");
    return { added, errors };
  }
  function resultFor(file) {
    return state.job?.results?.find((result) => Array.isArray(result.inputs) && result.inputs.includes(file.path));
  }
  function statusText(result) {
    if (!result) return state.busy ? "等待处理" : "等待开始";
    if (result.status === "done") {
      const before = formatSize(result.before);
      const after = formatSize(result.after);
      const merged = Array.isArray(result.inputs) && result.inputs.length > 1 ? "合并合计：" : "";
      return `${merged}${before} → ${after} · ${result.outputs?.length || 0} 个输出文件`;
    }
    if (result.status === "failed") return result.error || "处理失败";
    if (result.status === "cancelled") return "已取消";
    if (result.status === "running") return `处理中 ${state.job?.percent ?? 0}%`;
    return "等待处理";
  }
  function renderQueue() {
    const list = $2("files");
    list.replaceChildren();
    $2("empty").hidden = state.files.length > 0;
    $2("count").textContent = `${state.files.length} 个文件`;
    state.files.forEach((file, index) => {
      const result = resultFor(file);
      const row = element("div", "file");
      row.dataset.path = file.path;
      const badge = element("span", "type-badge", extOf(file.name));
      badge.classList.add(file.name.includes(".") ? "has-ext" : "no-ext");
      const main = element("div", "file-main");
      const name = element("div", "file-name", file.name);
      name.title = file.path;
      const meta = element("div", "file-meta");
      const source = element(
        "span",
        `source-tag ${file.source === "pc" ? "is-pc" : "is-nas"}`,
        `${file.source === "pc" ? "电脑上传" : "NAS"} · ${relativePath(file.path)}`
      );
      source.title = file.path;
      meta.append(source, element("span", "dot", "·"), element("span", "size", formatSize(file.size)));
      if (file.mtime) meta.append(element("span", "dot", "·"), element("span", "mtime", formatTime(file.mtime)));
      const status = element("span", "file-state", statusText(result));
      if (result?.status === "failed") status.classList.add("is-error");
      if (result?.status === "done") status.classList.add("is-done");
      meta.append(element("span", "dot", "·"), status);
      main.append(name, meta);
      if (result?.status === "running") {
        const progress = document.createElement("progress");
        progress.max = 100;
        progress.value = state.job?.percent ?? 0;
        main.append(progress);
      }
      const actions = element("div", "file-actions");
      if (result?.outputs?.length) {
        const open = element("button", "link", "打开位置");
        open.type = "button";
        open.onclick = () => showResultDialog(file);
        actions.append(open);
      }
      if (!state.busy) {
        const move = (label, aria, delta) => {
          const button = element("button", "link move", label);
          button.type = "button";
          button.setAttribute("aria-label", `${aria} ${file.name}`);
          button.disabled = delta === -1 && index === 0 || delta === 1 && index === state.files.length - 1;
          button.onclick = () => {
            const target = index + delta;
            [state.files[index], state.files[target]] = [state.files[target], state.files[index]];
            state.job = null;
            render();
          };
          actions.append(button);
        };
        move("↑", "上移", -1);
        move("↓", "下移", 1);
        const remove = element("button", "link remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", `移除 ${file.name}`);
        remove.onclick = () => {
          state.files.splice(index, 1);
          state.job = null;
          render();
        };
        actions.append(remove);
      }
      row.append(badge, main, actions);
      list.append(row);
    });
  }
  function openDialog({ title, subtitle, className = "result-dialog" }) {
    const dialog = document.createElement("dialog");
    dialog.className = className;
    const head = element("header", `${className}-head`);
    const heading = element("h2", "", title);
    head.append(heading);
    if (subtitle) head.append(element("p", `${className}-sub`, subtitle));
    const body = element("div", `${className}-body`);
    const foot = element("footer", `${className}-foot`);
    dialog.append(head, body, foot);
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    const closeButton = element("button", "secondary", "关闭");
    closeButton.type = "button";
    closeButton.onclick = () => dialog.close();
    foot.append(closeButton);
    return { dialog, body, foot, close: () => dialog.close() };
  }
  function showResultDialog(file) {
    const result = resultFor(file);
    if (!result?.outputs?.length) return;
    const job = state.job;
    const { body } = openDialog({ title: "处理结果", subtitle: file.name });
    const list = element("div", "result-list");
    for (const output of result.outputs) {
      const row = element("div", "result-row");
      const info = element("div", "result-info");
      const label = element("div", "result-name", baseName(output));
      label.title = output;
      info.append(label, element("div", "result-path", relativePath(output)));
      const link = element("a", "link", "下载到电脑");
      link.href = api.downloadUrl(job?.id, output);
      link.setAttribute("download", "");
      row.append(info, link);
      list.append(row);
    }
    body.append(list);
  }
  function canUse(entry, operation, mode) {
    if (!entry) return "不可用";
    if (entry.kind === "file" && mode === "output") return "保存位置只能选择文件夹";
    if (entry.disabled) return entry.disabledReason || "不可用";
    if (entry.kind === "file" && entry.matches === false) {
      const extensions = operationExtensions(operation);
      return `不匹配当前处理方式（需要 ${extensions.map((ext) => ext.toUpperCase()).join(" / ") || "匹配的文件"}）`;
    }
    return null;
  }
  function openNasPicker({ mode = "files", operation, startPath = null }) {
    const outputMode = mode === "output";
    const extensions = operationExtensions(operation);
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "nas-dialog";
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "nas-title");
      dialog.innerHTML = `
      <header class="nas-head">
        <h2 id="nas-title">${outputMode ? "选择保存文件夹" : "从 NAS 上选择"}</h2>
        <p class="nas-sub">${outputMode ? "保存位置只能选已授权的文件夹，结果写入这里，原文件不动。" : "只显示飞牛已授权的目录；灰色条目不可选，原因写在条目下方。"}</p>
      </header>
      <div class="nas-toolbar">
        <nav class="nas-crumbs" id="nas-crumbs" aria-label="目录路径"></nav>
        <button type="button" class="link" id="nas-up">上一级</button>
        <label class="nas-toggle"><input type="checkbox" id="nas-matched">仅显示匹配项</label>
      </div>
      <div class="nas-search">
        <input type="search" id="nas-search" placeholder="筛选文件名" aria-label="筛选文件名" autocomplete="off">
      </div>
      <div class="nas-scroll">
        <div class="nas-list" id="nas-list" role="list"></div>
        <div class="nas-panel" id="nas-panel" hidden></div>
      </div>
      <div class="nas-status" id="nas-status" role="status" aria-live="polite">正在读取目录…</div>
      <footer class="nas-foot">
        <button type="button" class="secondary" id="nas-folder" ${outputMode ? "hidden" : ""}>加入当前文件夹</button>
        <button type="button" class="link" id="nas-authorize">重新授权此文件夹</button>
        <button type="button" class="link" id="nas-check">检查目录权限</button>
        <span class="nas-spacer"></span>
        <button type="button" class="secondary" id="nas-cancel">取消</button>
        <button type="button" class="primary" id="nas-confirm">${outputMode ? "使用此文件夹" : "添加所选文件"}</button>
      </footer>`;
      document.body.append(dialog);
      const listNode = dialog.querySelector("#nas-list");
      const panel = dialog.querySelector("#nas-panel");
      const statusNode = dialog.querySelector("#nas-status");
      const crumbs = dialog.querySelector("#nas-crumbs");
      const searchInput = dialog.querySelector("#nas-search");
      const matchedInput = dialog.querySelector("#nas-matched");
      const upButton = dialog.querySelector("#nas-up");
      const folderButton = dialog.querySelector("#nas-folder");
      const authorizeButton = dialog.querySelector("#nas-authorize");
      const checkButton = dialog.querySelector("#nas-check");
      const confirmButton = dialog.querySelector("#nas-confirm");
      const cancelButton = dialog.querySelector("#nas-cancel");
      const selected = /* @__PURE__ */ new Map();
      let listing = null;
      let token = 0;
      let settled = false;
      let pending = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
        if (dialog.open) dialog.close();
        else dialog.remove();
      };
      dialog.addEventListener("close", () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
        dialog.remove();
      }, { once: true });
      const setPending = (value) => {
        pending = value;
        dialog.classList.toggle("is-busy", value);
        for (const button of [folderButton, authorizeButton, checkButton, confirmButton, upButton]) {
          button.disabled = value || button.dataset.off === "1";
        }
      };
      const clearPanel = () => {
        panel.hidden = true;
        panel.replaceChildren();
      };
      const openSettingsLink = (note) => {
        const button = element("button", "link nas-settings", "打开应用设置");
        button.type = "button";
        button.onclick = async () => {
          button.disabled = true;
          try {
            await api.openAppSetting();
            note.textContent = "已尝试打开飞牛应用设置；授权完成后回到轻页刷新列表即可，无需重启应用。";
          } catch (error) {
            note.textContent = `无法自动打开应用设置：${error.message}。请手动进入飞牛「应用中心 → 轻页 → 应用设置 → 目录授权」检查。`;
          } finally {
            button.disabled = false;
          }
        };
        return button;
      };
      const showFailure = (error) => {
        listNode.replaceChildren();
        panel.hidden = false;
        panel.replaceChildren();
        panel.append(element("p", "nas-error", error.message || "读取目录失败"));
        const hints = Array.isArray(error.hints) ? error.hints : [];
        if (hints.length) {
          const block = element("div", "nas-hints");
          block.append(element("strong", "", "可以这样处理："));
          const ul = element("ul", "");
          for (const hint of hints) ul.append(element("li", "", hint));
          block.append(ul);
          const note = element("p", "nas-note", "");
          block.append(note, openSettingsLink(note));
          panel.append(block);
        } else if (error.code === "NO_READ" || error.status === 403) {
          const block = element("div", "nas-hints");
          block.append(element("strong", "", "无法读取此目录"));
          block.append(element("p", "nas-note", "轻页以独立应用账号运行，只读取飞牛明确授权给轻页的目录。请点下面的「重新授权此文件夹」，授权完成后立即可用，无需重启应用。"));
          const note = element("p", "nas-note", "");
          block.append(note, openSettingsLink(note));
          panel.append(block);
        }
        updateStatus();
      };
      const panelTitle = (text) => {
        const row = element("div", "nas-panel-head");
        row.append(element("h3", "nas-panel-title", text));
        const close = element("button", "link nas-panel-close", "收起");
        close.type = "button";
        close.onclick = () => {
          panel.hidden = true;
          panel.replaceChildren();
        };
        row.append(close);
        return row;
      };
      const renderChildren = (children) => {
        if (!children || typeof children !== "object") return null;
        const scanned = firstNumber(children.scanned, children.total, children.count, children.examined);
        const readable = firstNumber(children.readable, children.readableCount);
        const blocked = firstNumber(children.unreadable, children.blocked, children.unreadableCount);
        const modes = countPairs(children.modes, "mode");
        const owners = countPairs(children.owners, "owner");
        const samples = Array.isArray(children.samples) ? children.samples.map((item) => typeof item === "string" ? item : item?.name || item?.path || "").filter(Boolean).slice(0, 6) : [];
        if (scanned === null && readable === null && blocked === null && !modes.length && !owners.length && !samples.length) return null;
        const box = element("div", "nas-children");
        const head = [];
        if (scanned !== null) head.push(`共扫描 ${scanned} 项`);
        if (readable !== null) head.push(`可读 ${readable}`);
        if (blocked !== null) head.push(`不可读 ${blocked}`);
        if (head.length) box.append(element("p", "nas-children-head", head.join(" · ")));
        if (modes.length) box.append(element("p", "nas-children-line", `权限位：${formatPairs(modes)}`));
        if (owners.length) box.append(element("p", "nas-children-line", `所有者：${formatPairs(owners)}`));
        if (samples.length) box.append(element("p", "nas-children-line", `示例：${samples.join("、")}`));
        return box;
      };
      const openFileManagerLink = (target, note) => {
        const button = element("button", "link nas-filemanager", "在文件管理器中打开");
        button.type = "button";
        button.onclick = async () => {
          button.disabled = true;
          try {
            await api.openFileManager(target);
            note.textContent = "已请求飞牛打开文件管理器；如果没有弹出窗口，请手动打开「文件管理器」定位该路径。";
          } catch (error) {
            note.textContent = `无法自动打开文件管理器：${error.message}。`;
          } finally {
            button.disabled = false;
          }
        };
        return button;
      };
      const renderPermission = (data, options = {}) => {
        panel.hidden = false;
        panel.replaceChildren();
        const target = data.path || options.path || "";
        if (options.title) panel.append(panelTitle(options.title));
        const head = element("div", "nas-perm-head", target);
        head.title = target;
        panel.append(head);
        if (data.exists === false) {
          panel.append(element("p", "nas-error", "这个位置已经不存在：可能已被移动、改名或所在存储空间已卸载。"));
        } else {
          const kindText = data.kind === "directory" ? "文件夹" : data.kind === "file" ? "文件" : data.kind || "未知";
          const facts = [
            `类型：${kindText}`,
            `权限位：${data.mode || "未知"}`,
            `所有者：${data.owner || "未知"}`,
            `读取：${data.readable ? "可以" : "不可以"}`,
            `写入：${data.writable ? "可以" : "不可以"}`
          ];
          if (options.reason) facts.push(`不可用原因：${options.reason}`);
          const grid = element("div", "nas-perm-grid");
          for (const fact of facts) grid.append(element("span", "nas-perm-fact", fact));
          panel.append(grid);
        }
        const childrenBox = renderChildren(data.children);
        if (childrenBox) panel.append(childrenBox);
        const links = element("div", "nas-panel-links");
        const note = element("p", "nas-note", "");
        links.append(openSettingsLink(note), openFileManagerLink(target, note));
        panel.append(links, note);
        const hints = Array.isArray(data.hints) ? data.hints : [];
        if (hints.length) {
          const block = element("div", "nas-hints");
          block.append(element("strong", "", options.reason ? "为什么不可用，可以这样处理：" : "按下面的步骤修复权限："));
          const ul = element("ul", "");
          for (const hint of hints) ul.append(element("li", "", hint));
          block.append(ul);
          panel.append(block);
        }
      };
      const explainEntry = async (entry, reason) => {
        setPending(true);
        panel.hidden = false;
        panel.replaceChildren(element("p", "nas-note", "正在读取该条目的权限信息…"));
        try {
          const data = await api.permission(entry.path, "r");
          renderPermission(data, {
            title: `为什么“${entry.name}”不可用`,
            reason,
            path: entry.path
          });
        } catch (error) {
          panel.replaceChildren();
          const block = element("div", "nas-hints");
          block.append(element("strong", "", "无法读取该条目的权限信息"));
          block.append(element("p", "nas-error", error.message));
          for (const hint of Array.isArray(error.hints) ? error.hints : []) block.append(element("p", "nas-note", `· ${hint}`));
          const note = element("p", "nas-note", "");
          block.append(note);
          const links = element("div", "nas-panel-links");
          links.append(openSettingsLink(note), openFileManagerLink(entry.path, note));
          block.append(links);
          panel.append(block);
        } finally {
          setPending(false);
          updateStatus();
        }
      };
      const updateStatus = () => {
        const counts = listing?.counts || {};
        const matched = Number.isFinite(counts.matched) ? counts.matched : (listing?.entries || []).filter((entry) => entry.kind === "file" && entry.matches).length;
        const parts = [];
        if (outputMode) {
          parts.push(`当前目录 ${Number.isFinite(counts.directories) ? counts.directories : (listing?.entries || []).filter((entry) => entry.kind === "dir").length} 个文件夹`);
        } else {
          parts.push(`已选 ${selected.size} 个文件`);
          parts.push(`当前目录 ${matched} 个匹配`);
        }
        if (Number.isFinite(counts.blocked) && counts.blocked > 0) parts.push(`${counts.blocked} 个不可用`);
        if (Number.isFinite(counts.hidden) && counts.hidden > 0) parts.push(`${counts.hidden} 个隐藏项`);
        statusNode.textContent = pending ? "正在处理…" : listing ? parts.join(" · ") : "未选择目录";
        confirmButton.textContent = outputMode ? "使用此文件夹" : `添加所选文件${selected.size ? `（${selected.size}）` : ""}`;
        confirmButton.disabled = pending || (outputMode ? !listing?.path : selected.size === 0);
        confirmButton.dataset.off = confirmButton.disabled ? "1" : "0";
        const hasPath = Boolean(listing?.path);
        folderButton.dataset.off = hasPath ? "0" : "1";
        folderButton.disabled = pending || !hasPath;
        folderButton.title = hasPath ? "" : "授权目录根位置不能整体加入，请先进入一个文件夹";
        upButton.disabled = pending || !listing?.parent;
        authorizeButton.dataset.off = listing?.path || listing?.root || startPath ? "0" : "1";
        authorizeButton.disabled = pending || authorizeButton.dataset.off === "1";
        authorizeButton.title = "向飞牛申请这个文件夹的访问权限，授权完成后立即可用，无需重启应用";
        checkButton.disabled = pending || !(listing?.path || listing?.root || startPath);
      };
      const renderCrumbs = () => {
        crumbs.replaceChildren();
        const home = element("button", "crumb", "全部授权目录");
        home.type = "button";
        home.onclick = () => load(null);
        crumbs.append(home);
        if (!listing?.path) {
          home.classList.add("is-current");
          home.setAttribute("aria-current", "true");
          return;
        }
        const root = listing.root || startPath || listing.path;
        const pieces = relativeTo(root, listing.path).split("/").filter(Boolean);
        const join = (value) => root.endsWith("/") || root.endsWith("\\") ? root + value : `${root}/${value}`;
        const separator = () => element("span", "crumb-sep", "/");
        let current = root;
        for (let index = 0; index <= pieces.length; index += 1) {
          const label = index === 0 ? baseName(root) : pieces[index - 1];
          if (index > 0) current = join(pieces.slice(0, index).join("/"));
          const crumb = element("button", "crumb", label);
          crumb.type = "button";
          crumb.title = current;
          crumb.onclick = () => load(current);
          if (index === pieces.length) crumb.classList.add("is-current");
          crumbs.append(separator(), crumb);
        }
        const last = crumbs.querySelector(".is-current");
        if (last) last.setAttribute("aria-current", "true");
      };
      const renderRows = () => {
        listNode.replaceChildren();
        const entries = [...listing?.entries || []];
        const term = searchInput.value.trim().toLowerCase();
        const visible = entries.filter((entry) => {
          if (term && !String(entry.name || "").toLowerCase().includes(term)) return false;
          if (matchedInput.checked && entry.kind === "file" && !entry.matches) return false;
          return true;
        });
        visible.sort((a2, b2) => {
          const rank = (entry) => entry.kind === "dir" ? 0 : entry.matches ? 1 : 2;
          return rank(a2) - rank(b2) || String(a2.name).localeCompare(String(b2.name), "zh-CN");
        });
        for (const entry of visible) {
          if (entry.kind === "dir") {
            const row2 = element("div", "nas-row is-dir");
            row2.dataset.path = entry.path;
            row2.dataset.kind = "dir";
            if (entry.root) row2.dataset.root = "true";
            const button = element("button", "nas-row-main");
            button.type = "button";
            button.setAttribute("aria-label", `打开文件夹 ${entry.name}`);
            button.onclick = () => load(entry.path);
            const icon2 = element("span", "nas-icon", "📁");
            icon2.setAttribute("aria-hidden", "true");
            const text2 = element("span", "nas-text");
            const name2 = element("span", "nas-name", entry.name);
            name2.title = entry.path;
            const meta2 = element("span", "nas-meta");
            meta2.append(element("span", "nas-kind", entry.root ? "授权目录" : "文件夹"));
            if (entry.writable === false) meta2.append(element("span", "nas-flag", "· 只读"));
            text2.append(name2, meta2);
            button.append(icon2, text2);
            row2.append(button);
            listNode.append(row2);
            continue;
          }
          const reason = canUse(entry, operation, mode);
          const row = element("div", `nas-row is-file${reason ? " is-disabled" : ""}`);
          row.dataset.path = entry.path;
          row.dataset.kind = "file";
          row.dataset.matches = entry.matches ? "true" : "false";
          row.dataset.disabled = reason ? "true" : "false";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "nas-check";
          checkbox.disabled = Boolean(reason) || pending;
          checkbox.checked = selected.has(entry.path);
          checkbox.setAttribute("aria-label", `选择 ${entry.name}`);
          checkbox.onchange = () => {
            if (checkbox.checked) selected.set(entry.path, { path: entry.path, name: entry.name, size: entry.size, mtime: entry.mtime });
            else selected.delete(entry.path);
            updateStatus();
          };
          const icon = element("span", "nas-icon", reason ? "⚠" : "📄");
          icon.setAttribute("aria-hidden", "true");
          const text = element("span", "nas-text");
          const name = element("span", "nas-name", entry.name);
          name.title = entry.path;
          const meta = element("span", "nas-meta");
          meta.append(element("span", "nas-tag", extOf(entry.name)), element("span", "nas-size", formatSize(entry.size)));
          meta.append(element("span", "nas-dot", "·"), element("span", "nas-time", formatTime(entry.mtime)));
          if (!reason) meta.append(element("span", "nas-dot", "·"), element("span", entry.matches ? "nas-match" : "nas-unmatch", entry.matches ? "匹配" : "不匹配"));
          text.append(name, meta);
          if (reason) text.append(element("span", "nas-reason", reason));
          row.append(checkbox, icon, text);
          if (reason) {
            row.classList.add("is-clickable");
            row.tabIndex = 0;
            row.setAttribute("role", "button");
            row.setAttribute("aria-label", `为什么“${entry.name}”不可用，查看权限原因`);
            row.title = "点击查看该条目的权限位、所有者与修复步骤";
            text.append(element("span", "nas-more", "查看原因"));
            const open = (event) => {
              if (event && event.target && event.target.closest && event.target.closest("input")) return;
              explainEntry(entry, reason);
            };
            row.addEventListener("click", open);
            row.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
              }
            });
          }
          listNode.append(row);
        }
        if (!visible.length) {
          const entriesAll = entries.length;
          const emptyText = !listing?.path ? "还没有可用的授权目录：请点「重新授权此文件夹」，或到飞牛应用设置 → 目录授权添加文件夹。" : entriesAll && matchedInput.checked ? `此文件夹没有匹配当前处理方式的文件（共 ${entriesAll} 个条目，可取消「仅显示匹配项」查看全部）` : entriesAll ? "没有符合筛选条件的条目" : "此文件夹是空的";
          listNode.append(element("div", "nas-empty", emptyText));
        }
        const warnings = Array.isArray(listing?.warnings) ? listing.warnings : [];
        if (warnings.length) {
          const box = element("div", "nas-warn");
          for (const warning of warnings) box.append(element("p", "", warning));
          listNode.append(box);
        }
      };
      async function load(target) {
        const current = ++token;
        listNode.setAttribute("aria-busy", "true");
        statusNode.textContent = "正在读取目录…";
        try {
          const data = await api.list(target ?? null, operation);
          if (current !== token) return;
          listing = data;
          clearPanel();
          renderCrumbs();
          renderRows();
          updateStatus();
        } catch (error) {
          if (current !== token) return;
          listing = null;
          renderCrumbs();
          showFailure(error);
        } finally {
          if (current === token) listNode.removeAttribute("aria-busy");
        }
      }
      const commit = (result) => {
        const errors = [...result?.errors || []];
        for (const skipped of result?.skipped || []) {
          errors.push(`${baseName(skipped.path)}：${skipped.reason || "无法加入"}`);
        }
        const added = (result?.added || []).map((item) => ({
          ...item,
          mtime: selected.get(item.path)?.mtime ?? item.mtime ?? null
        }));
        finish({ action: "add", added, errors, summary: result?.summary || null });
      };
      const runSelect = async () => {
        if (!selected.size) {
          panel.hidden = false;
          panel.replaceChildren(element("p", "nas-note", "请先在上面的列表里勾选文件。"));
          return;
        }
        if (selected.size > MAX_FILES) {
          panel.hidden = false;
          panel.replaceChildren(element("p", "nas-error", `一次最多添加 ${MAX_FILES} 个文件，请分批选择。`));
          return;
        }
        setPending(true);
        try {
          commit(await api.select([...selected.keys()], operation));
        } catch (error) {
          showFailure(error);
        } finally {
          setPending(false);
        }
      };
      const runFolder = async () => {
        if (!listing?.path) return;
        setPending(true);
        try {
          commit(await api.folder(listing.path, operation));
        } catch (error) {
          showFailure(error);
        } finally {
          setPending(false);
        }
      };
      const runAuthorize = async () => {
        const target = listing?.path || listing?.root || startPath;
        if (!target) return;
        setPending(true);
        panel.hidden = false;
        panel.replaceChildren(element("p", "nas-note", "正在向飞牛申请该文件夹的访问权限…"));
        try {
          const authorized = await api.authorizeFolder(target);
          let granted = null;
          let grantError = null;
          try {
            granted = await api.grant(target);
          } catch (error) {
            grantError = error;
          }
          const settings = await api.settings().catch(() => null);
          if (settings) applySettings(settings);
          await load(granted?.path || target);
          panel.hidden = false;
          panel.replaceChildren();
          const lines = element("div", "nas-hints");
          if (grantError) {
            lines.append(element("strong", "", "授权已提交，但轻页账号仍无法读取"));
            lines.append(element("p", "nas-error", grantError.message));
            for (const hint of grantError.hints || []) lines.append(element("p", "nas-note", `· ${hint}`));
            const note = element("p", "nas-note", "");
            lines.append(note, openSettingsLink(note));
          } else {
            lines.append(element("strong", "", "授权已完成，这个文件夹现在可以直接使用"));
            lines.append(element("p", "nas-note", granted?.path ? `已授权：${granted.path}` : "飞牛已返回授权结果，无需重启应用。"));
            if (authorized.paths.length) lines.append(element("p", "nas-note", `本次授权返回 ${authorized.paths.length} 个目录。`));
          }
          panel.append(lines);
        } catch (error) {
          panel.replaceChildren();
          const block = element("div", "nas-hints");
          block.append(element("strong", "", "重新授权未完成"));
          block.append(element("p", "nas-error", error.message));
          block.append(element("p", "nas-note", "仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。"));
          const note = element("p", "nas-note", "");
          block.append(note, openSettingsLink(note));
          panel.append(block);
        } finally {
          setPending(false);
          updateStatus();
        }
      };
      const runCheck = async () => {
        const target = listing?.path || listing?.root || startPath;
        if (!target) return;
        setPending(true);
        try {
          renderPermission(await api.permission(target, "r"));
          if (outputMode) statusNode.textContent = "已检查该文件夹的权限";
        } catch (error) {
          showFailure(error);
        } finally {
          setPending(false);
          updateStatus();
        }
      };
      searchInput.addEventListener("input", () => renderRows());
      matchedInput.addEventListener("change", () => renderRows());
      upButton.onclick = () => load(listing?.parent ?? null);
      folderButton.onclick = runFolder;
      authorizeButton.onclick = runAuthorize;
      checkButton.onclick = runCheck;
      confirmButton.onclick = () => {
        if (outputMode) finish({ action: "output", folder: listing?.path || null });
        else runSelect();
      };
      cancelButton.onclick = () => finish(null);
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(null);
      });
      dialog.showModal();
      renderCrumbs();
      updateStatus();
      load(startPath);
    });
  }
  function buildOptions() {
    const container = $2("options");
    container.replaceChildren();
    const operation = state.operation;
    const meta = OPERATIONS[operation];
    const field = (label, id, values, value, type = "select", hint = "") => {
      const wrapper = element("label", "option-field");
      wrapper.append(element("span", "", label));
      let control;
      if (type === "select") {
        control = document.createElement("select");
        for (const item of values) {
          const [optionValue, optionLabel] = Array.isArray(item) ? item : [item, String(item).toUpperCase()];
          const option = document.createElement("option");
          option.value = String(optionValue);
          option.textContent = String(optionLabel);
          control.append(option);
        }
      } else {
        control = document.createElement("input");
        control.type = type;
      }
      control.id = id;
      control.value = value;
      wrapper.append(control);
      if (hint) wrapper.append(element("span", "option-hint", hint));
      container.append(wrapper);
      return control;
    };
    if (operation === "pdf_compress") {
      const target = field("目标大小 MB（可选）", "target-mb", [], "", "number");
      target.min = "0.1";
      target.max = "500";
      target.step = "0.1";
      target.placeholder = "留空自动压缩";
    }
    if (operation === "image_convert") field("输出格式", "format", ["jpg", "png", "webp"], "jpg");
    if (operation === "pdf_to_images") field("输出格式", "format", ["png", "jpg"], "png");
    if (["image_convert", "pdf_to_images"].includes(operation)) field("最长边（像素）", "dimension", [], 2600, "number");
    if (operation === "pdf_split") field("提取页码", "pages", [], "1-3", "text");
    if (operation === "audio_convert") field("输出格式", "format", ["mp3", "wav", "flac", "m4a"], "mp3");
    if (operation === "video_convert") {
      field("最大高度", "height", [480, 720, 1080, 2160], 1080);
      field("硬件加速", "hw", [["auto", "自动"], ["off", "关闭"]], "auto", "select", "无核显时自动用 CPU");
    }
    if (operation === "office_to_pdf") container.append(element("span", "note", "输出 PDF；排版可能受本机字体影响。缺少办公组件时任务会提示。"));
    document.querySelector(".presets").hidden = PRESET_HIDDEN.includes(operation);
    $2("formats").textContent = `${(meta?.extensions || []).map((ext) => ext.toUpperCase()).join(" / ")} · 每批最多 ${MAX_FILES} 个文件`;
    $2("operation-note").textContent = meta?.combined ? "按列表顺序合并，可用箭头调整顺序" : "";
  }
  function collectOptions() {
    const operation = state.operation;
    const options = { preset: document.querySelector("input[name=preset]:checked")?.value || "balanced" };
    if ($2("format")) options.format = $2("format").value;
    if ($2("dimension")?.value) options.maxDimension = Number($2("dimension").value);
    if ($2("height")?.value) options.maxHeight = Number($2("height").value);
    if ($2("pages")?.value) options.pages = $2("pages").value.replace(/\s/g, "");
    if ($2("target-mb")?.value) options.targetMB = Number($2("target-mb").value);
    if ($2("hw")?.value) options.hw = $2("hw").value;
    const validated = validateOptions(operation, options);
    if (operation === "video_convert") validated.hw = options.hw === "off" ? "off" : "auto";
    return validated;
  }
  function renderFolder() {
    const target = state.outputDir || state.settings?.defaultOutput || null;
    const label = $2("folder");
    label.textContent = target || "与第一个文件相同的文件夹";
    label.title = target || "";
    $2("folder-reset").hidden = !state.outputDir;
  }
  function renderControls() {
    const busy = state.busy || state.uploading;
    for (const id of ["pick-nas", "upload-pc", "operation", "clear", "folder-pick", "folder-reset"]) {
      if ($2(id)) $2(id).disabled = busy;
    }
    $2("clear").disabled = busy || state.files.length === 0;
    $2("start").disabled = busy || state.files.length === 0;
    $2("cancel").hidden = !state.busy;
    document.querySelectorAll("input[name=preset],#options input,#options select,#nav button").forEach((node) => {
      node.disabled = busy;
    });
  }
  function renderSummary() {
    const job = state.job;
    if (job?.status === "running") {
      $2("summary").textContent = `${job.stage || "正在处理"} ${job.percent ?? 0}%`;
      $2("hint").textContent = "处理过程中可随时取消，原文件不受影响。";
      return;
    }
    if (!job) {
      $2("summary").textContent = "准备好，开始处理文件";
      $2("hint").textContent = "结果另存，原文件始终保留。";
      return;
    }
    const done = (job.results || []).filter((result) => result.status === "done").length;
    const failed = (job.results || []).filter((result) => result.status === "failed").length;
    const stopped = job.status === "cancelled" || job.status === "interrupted";
    $2("summary").textContent = `${stopped ? "任务已停止" : "处理完成"} · ${done} 个成功${failed ? `，${failed} 个失败` : ""}`;
    const outputs = (job.results || []).reduce((sum, result) => sum + (result.outputs?.length || 0), 0);
    $2("hint").textContent = `已生成 ${outputs} 个文件 · 原文件保留`;
    if (job.error) setMessage(job.error, "error");
  }
  function render() {
    renderQueue();
    renderControls();
    renderSummary();
    renderFolder();
  }
  function switchGroup(group) {
    if (state.busy) return;
    state.group = group;
    const meta = GROUPS[group];
    $2("title").textContent = meta.label;
    $2("subtitle").textContent = meta.subtitle;
    document.querySelectorAll("#nav button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.group === group);
    });
    $2("work-panel").hidden = group === "settings";
    $2("settings-panel").hidden = group !== "settings";
    state.files = [];
    state.job = null;
    setMessage("");
    if (group === "settings") {
      loadSettingsPage();
      return;
    }
    const operations = Object.entries(OPERATIONS).filter(([, value]) => value.group === group);
    const select = $2("operation");
    select.replaceChildren();
    for (const [key, value] of operations) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = value.label;
      select.append(option);
    }
    state.operation = select.value || operations[0]?.[0] || "pdf_compress";
    buildOptions();
    render();
  }
  async function uploadLocal(files) {
    if (!files.length) return;
    if (state.uploading) return;
    state.uploading = true;
    render();
    setMessage(`正在上传 ${files.length} 个文件到共享目录…`, "info");
    try {
      const result = await api.upload(files, state.operation, {
        onProgress: (text) => setMessage(text, "info"),
        onHints: (hints) => setMessage(hints.join("\n"), "error")
      });
      state.uploading = false;
      mergeResult({ added: result.added, errors: result.errors }, { source: "pc" });
      if (!result.errors.length && result.added.length) {
        setMessage(`已上传 ${result.added.length} 个文件，保存在「上传文件」目录。`, "info");
      }
    } catch (error) {
      state.uploading = false;
      setMessage(error.message, "error");
      render();
    }
  }
  async function startJob() {
    if (state.busy || state.uploading || !state.files.length) return;
    const meta = OPERATIONS[state.operation];
    let options;
    try {
      options = collectOptions();
    } catch (error) {
      setMessage(error.message, "error");
      return;
    }
    if (meta?.combined && state.files.length < 2) {
      setMessage("合并任务至少需要 2 个文件", "error");
      return;
    }
    await ensureSettings();
    const outputDir = state.outputDir || state.settings?.defaultOutput || dirName(state.files[0].path);
    if (!outputDir) {
      setMessage("请先选择保存位置", "error");
      return;
    }
    state.busy = true;
    state.job = null;
    setMessage("");
    render();
    try {
      const { jobId } = await api.start({
        operation: state.operation,
        inputs: state.files.map((file) => file.path),
        outputDir,
        options
      });
      const snapshot = await api.status(jobId);
      state.job = snapshot;
      state.busy = snapshot.status === "running";
      render();
    } catch (error) {
      state.busy = false;
      state.job = null;
      setMessage(error.message, "error");
      render();
    }
  }
  async function cancelJob() {
    if (!state.job?.id) return;
    try {
      state.job = await api.cancel(state.job.id);
      state.busy = state.job.status === "running";
      render();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }
  async function reauthorizeFolder(target) {
    await api.authorizeFolder(target);
    let granted = null;
    let grantError = null;
    try {
      granted = await api.grant(target);
    } catch (error) {
      grantError = error;
    }
    const settings = await api.settings().catch(() => null);
    if (settings) applySettings(settings);
    return { granted, grantError, settings };
  }
  function settingsButton(row, note) {
    const link = element("button", "link", "打开应用设置");
    link.type = "button";
    link.onclick = async () => {
      link.disabled = true;
      try {
        await api.openAppSetting();
        note.textContent = "已打开飞牛应用设置；授权完成后刷新页面即可，无需重启应用。";
      } catch (error) {
        note.textContent = `无法自动打开应用设置：${error.message}。请手动进入飞牛「应用中心 → 轻页 → 应用设置 → 目录授权」重新选择该目录。`;
      } finally {
        link.disabled = false;
      }
    };
    row.append(link);
    return link;
  }
  function renderRoots(roots = [], missingRoots = []) {
    const box = $2("roots");
    box.replaceChildren();
    if (!roots.length) {
      const empty = element("p", "roots-empty", "尚未授权任何目录，轻页无法读写 NAS 文件。请在飞牛应用设置 → 目录授权中选择文件夹，系统会自动为轻页账号授予 ACL。");
      const note = element("p", "small-note", "");
      box.append(empty);
      settingsButton(box, note);
      box.append(note);
    }
    for (const root of roots) {
      const item = typeof root === "string" ? { path: root, name: baseName(root), writable: null, shared: false } : root;
      const row = element("div", "root-row");
      const info = element("div", "root-info");
      const title = element("strong", "", item.name || baseName(item.path));
      const pathNode = element("span", "root-path", item.path);
      pathNode.title = item.path;
      const flags = element("span", "root-flags");
      if (item.shared) flags.append(element("span", "tag", "共享目录"));
      flags.append(element("span", "tag", item.writable === false ? "只读" : "可写"));
      info.append(title, pathNode, flags);
      const actions = element("div", "root-actions");
      const result = element("div", "root-result");
      const check = element("button", "link", "检查权限");
      check.type = "button";
      check.onclick = async () => {
        check.disabled = true;
        result.replaceChildren(element("span", "small-note", "正在检查…"));
        try {
          const data = await api.permission(item.path, "r");
          result.replaceChildren();
          result.append(element(
            "span",
            `perm-line ${data.readable ? "is-ok" : "is-bad"}`,
            `读取：${data.readable ? "可以" : "不可以"} · 写入：${data.writable ? "可以" : "不可以"} · 权限位 ${data.mode || "未知"}`
          ));
          if (Array.isArray(data.hints) && data.hints.length) {
            const ul = element("ul", "hint-list");
            for (const hint of data.hints) ul.append(element("li", "", hint));
            result.append(ul);
            const note = element("p", "small-note", "");
            const linkRow = element("div", "root-result");
            settingsButton(linkRow, note);
            result.append(linkRow, note);
          }
        } catch (error) {
          result.replaceChildren(element("span", "perm-line is-bad", error.message));
        } finally {
          check.disabled = false;
        }
      };
      const reauth = element("button", "link", "重新授权");
      reauth.type = "button";
      reauth.title = "向飞牛申请这个目录的访问权限，授权完成后立即可用，无需重启应用";
      reauth.onclick = async () => {
        reauth.disabled = true;
        check.disabled = true;
        result.replaceChildren(element("span", "small-note", "正在向飞牛申请授权…"));
        try {
          const { granted, grantError } = await reauthorizeFolder(item.path);
          if (grantError) {
            result.replaceChildren();
            result.append(element("span", "perm-line is-bad", `授权已提交，但轻页账号仍无法读取：${grantError.message}`));
            if (Array.isArray(grantError.hints) && grantError.hints.length) {
              const ul = element("ul", "hint-list");
              for (const hint of grantError.hints) ul.append(element("li", "", hint));
              result.append(ul);
            }
            setSettingsNote("授权未真正落到轻页账号，请按提示重新选择该目录。", true);
          } else {
            setSettingsNote(`授权完成：${granted?.path || item.path}，无需重启应用。`);
            const settings = state.settings;
            if (settings) renderRoots(settings.roots || [], settings.missingRoots || []);
          }
        } catch (error) {
          result.replaceChildren(element("span", "perm-line is-bad", error.message));
        } finally {
          reauth.disabled = false;
          check.disabled = false;
        }
      };
      actions.append(check, reauth);
      row.append(info, actions, result);
      box.append(row);
    }
    const warn = $2("missing-roots");
    warn.replaceChildren();
    if (missingRoots.length) {
      warn.hidden = false;
      warn.append(element("strong", "", "以下授权目录已失效（不影响应用启动）："));
      for (const path of missingRoots) warn.append(element("p", "", path));
      warn.append(element("p", "", "目录被移动、改名或所在存储空间卸载后会失效；请重新选择新的路径。"));
    } else {
      warn.hidden = true;
    }
  }
  function hardwareLine(hardware) {
    if (!hardware || typeof hardware !== "object") return null;
    const available = hardware.available ?? hardware.ok ?? hardware.enabled;
    if (available === void 0 || available === null) return null;
    if (available) {
      const backend = String(hardware.backend || hardware.api || "VAAPI").toUpperCase();
      const device = hardware.device || hardware.path || hardware.renderDevice || "";
      return { text: `视频硬件加速：可用（${backend}${device ? ` · ${device}` : ""}）`, ok: true };
    }
    const reason = hardware.reason || hardware.message || hardware.detail || "当前系统没有可用的视频硬件加速";
    return { text: `视频硬件加速：不可用（${reason}）`, ok: false };
  }
  function renderComponents(components = {}, hardware = null, webInfo = null) {
    const box = $2("components");
    box.replaceChildren();
    const rows = [
      ["media", "音视频组件 · FFmpeg", components.media],
      ["office", "办公组件 · LibreOffice", components.office]
    ];
    for (const [, label, value] of rows) {
      const row = element("div", "component-row");
      row.append(element("strong", "", label), element("span", `component-state ${value ? "is-ok" : "is-bad"}`, value ? `已就绪：${value}` : "未安装或未检测到"));
      box.append(row);
    }
    const hw = hardwareLine(hardware);
    if (hw) {
      const row = element("div", "component-row hw-row");
      row.append(element("span", `hw-line ${hw.ok ? "is-ok" : "is-bad"}`, hw.text));
      box.append(row);
    }
    const web = webEntryLine(webInfo);
    if (web) {
      const row = element("div", "component-row web-row");
      row.append(element("span", "hw-line", web.text));
      box.append(row);
    }
  }
  function webEntryLine(web) {
    if (!web || typeof web !== "object" || !web.url) return null;
    return { text: `本机 Web 入口：${web.url}（仅本机回环，需 SSH 隧道或反向代理）` };
  }
  var JOB_STATUS = {
    running: "进行中",
    completed: "已完成",
    completed_with_errors: "部分失败",
    cancelled: "已取消",
    interrupted: "已中断",
    failed: "失败"
  };
  function renderHistory(jobs = []) {
    const box = $2("history");
    box.replaceChildren();
    if (!jobs.length) {
      box.append(element("p", "history-empty", "暂无任务记录。"));
      return;
    }
    for (const job of jobs) {
      const row = element("div", "history-row");
      const info = element("div", "history-info");
      const label = OPERATIONS[job.operation]?.label || job.operation;
      info.append(element("strong", "", `${label} · ${job.results?.filter((result) => result.status === "done").length || 0} 个成功`));
      info.append(element("span", "history-meta", `${formatMoment(job.createdAt)} · ${JOB_STATUS[job.status] || "已结束"}`));
      const outputs = (job.results || []).flatMap((result) => result.outputs || []);
      info.append(element("span", "history-path", outputs.length ? outputs.map((path) => relativePath(path)).join("、") : job.stage || "无输出"));
      const retry = element("button", "secondary", "按原参数重试");
      retry.type = "button";
      retry.disabled = job.status === "running";
      retry.onclick = async () => {
        retry.disabled = true;
        try {
          await api.retry(job.id);
          setSettingsNote("重试任务已提交，可在任务历史中查看进度。");
          setTimeout(loadHistory, 1200);
        } catch (error) {
          setSettingsNote(`重试失败：${error.message}`, true);
        } finally {
          retry.disabled = false;
        }
      };
      row.append(info, retry);
      box.append(row);
    }
  }
  function setSettingsNote(text, isError = false) {
    const node = $2("settings-note");
    node.textContent = text || "";
    node.classList.toggle("is-error", isError);
  }
  async function loadHistory() {
    try {
      renderHistory(await api.history());
    } catch (error) {
      $2("history").replaceChildren(element("p", "is-error", `读取任务历史失败：${error.message}`));
    }
  }
  async function loadSettingsPage() {
    setSettingsNote("");
    const settings = await ensureSettings();
    if (settings) {
      renderRoots(settings.roots || [], settings.missingRoots || []);
      renderComponents(settings.components || {}, settings.hardware ?? null, settings.web ?? null);
    }
    await loadHistory();
  }
  function bind() {
    document.querySelectorAll("#nav button").forEach((button) => {
      button.onclick = () => switchGroup(button.dataset.group);
    });
    $2("operation").onchange = () => {
      state.operation = $2("operation").value;
      state.files = [];
      state.job = null;
      setMessage("");
      buildOptions();
      render();
    };
    document.querySelectorAll("input[name=preset]").forEach((input) => {
      input.onchange = () => {
        document.querySelectorAll(".preset").forEach((label) => {
          label.classList.toggle("selected", label.querySelector("input").checked);
        });
      };
    });
    $2("pick-nas").onclick = async (event) => {
      event.stopPropagation();
      if (state.busy) return;
      const result = await openNasPicker({ mode: "files", operation: state.operation });
      if (!result) return;
      mergeResult(result, { source: "nas" });
    };
    $2("upload-pc").onclick = (event) => {
      event.stopPropagation();
      if (state.busy) return;
      $2("file-input").click();
    };
    $2("file-input").onchange = async (event) => {
      const files = [...event.target.files || []];
      event.target.value = "";
      await uploadLocal(files);
    };
    $2("dropzone").addEventListener("keydown", (event) => {
      if (event.target !== $2("dropzone")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        $2("pick-nas").click();
      }
    });
    for (const type of ["dragenter", "dragover", "drop"]) {
      document.addEventListener(type, (event) => event.preventDefault());
    }
    $2("dropzone").addEventListener("dragover", () => {
      if (!state.busy && !state.uploading) $2("dropzone").classList.add("is-drag");
    });
    $2("dropzone").addEventListener("dragleave", () => $2("dropzone").classList.remove("is-drag"));
    $2("dropzone").addEventListener("drop", async (event) => {
      $2("dropzone").classList.remove("is-drag");
      if (state.busy || state.uploading) return;
      const files = [...event.dataTransfer?.files || []];
      if (files.length) await uploadLocal(files);
    });
    $2("clear").onclick = () => {
      state.files = [];
      state.job = null;
      setMessage("");
      render();
    };
    $2("folder-pick").onclick = async () => {
      if (state.busy) return;
      const result = await openNasPicker({ mode: "output", operation: state.operation });
      if (!result?.folder) return;
      state.outputDir = result.folder;
      renderFolder();
    };
    $2("folder-reset").onclick = () => {
      state.outputDir = null;
      renderFolder();
    };
    $2("start").onclick = startJob;
    $2("cancel").onclick = cancelJob;
    $2("open-settings").onclick = async () => {
      try {
        await api.openAppSetting();
        setSettingsNote("已尝试打开飞牛应用设置。");
      } catch (error) {
        setSettingsNote(`无法自动打开应用设置：${error.message}。请手动进入「应用中心 → 轻页 → 应用设置」。`, true);
      }
    };
    api.onEvent((job) => {
      if (!job?.id) return;
      state.job = job;
      state.busy = job.status === "running";
      render();
      if (!state.busy && state.group === "settings") loadHistory();
    });
  }
  async function boot() {
    bind();
    await ensureSettings();
    buildOptions();
    render();
    switchGroup("pdf");
    window.qingyeReady = true;
  }
  boot().catch((error) => {
    setMessage(`界面启动失败：${error.message}。请刷新页面；如仍失败，请反馈这段提示。`, "error");
    if (window.console) console.error(error);
  });
})();

window.qingyeReady = true;
} catch (error) {
var box = document.getElementById('message');
if (box) box.textContent = '界面启动失败：' + error.message + '。请刷新页面；如仍失败，请反馈这段提示。';
console.error(error);
}
