"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("@riim/logger");
const next_tick_1 = require("@riim/next-tick");
const EventEmitter_1 = require("./EventEmitter");
const WaitError_1 = require("./WaitError");
function defaultPut(cell, value) {
    cell.push(value);
}
const pendingCells = [];
let pendingCellsIndex = 0;
let afterRelease;
let currentCell = null;
const $error = { error: null };
let lastUpdationId = 0;
function release() {
    for (; pendingCellsIndex < pendingCells.length; pendingCellsIndex++) {
        if (pendingCells[pendingCellsIndex]._active) {
            pendingCells[pendingCellsIndex].actualize();
        }
    }
    pendingCells.length = 0;
    pendingCellsIndex = 0;
    if (afterRelease) {
        let afterRelease_ = afterRelease;
        afterRelease = null;
        for (let cb of afterRelease_) {
            cb();
        }
    }
}
class Cell extends EventEmitter_1.EventEmitter {
    constructor(value, options) {
        super();
        this._reactions = [];
        this._error = null;
        this._lastErrorEvent = null;
        this._hasSubscribers = false;
        this._active = false;
        this._currentlyPulling = false;
        this._updationId = -1;
        this.debugKey = options && options.debugKey;
        this.context = options && options.context !== undefined ? options.context : this;
        this._pull = typeof value == 'function' ? value : null;
        this._get = (options && options.get) || null;
        this._validate = (options && options.validate) || null;
        this._merge = (options && options.merge) || null;
        this._put = (options && options.put) || defaultPut;
        this._reap = (options && options.reap) || null;
        this.meta = (options && options.meta) || null;
        if (this._pull) {
            this._dependencies = undefined;
            this._value = undefined;
            this._state = 'dirty';
            this._inited = false;
        }
        else {
            this._dependencies = null;
            if (this._validate) {
                this._validate(value, undefined);
            }
            if (this._merge) {
                value = this._merge(value, undefined);
            }
            this._value = value;
            this._state = 'actual';
            this._inited = true;
            if (value instanceof EventEmitter_1.EventEmitter) {
                value.on('change', this._onValueChange, this);
            }
        }
        if (options) {
            if (options.onChange) {
                this.on('change', options.onChange);
            }
            if (options.onError) {
                this.on('error', options.onError);
            }
        }
    }
    static get currentlyPulling() {
        return !!currentCell;
    }
    static release() {
        release();
    }
    static afterRelease(cb) {
        (afterRelease || (afterRelease = [])).push(cb);
    }
    on(type, listener, context) {
        if (this._dependencies !== null) {
            this.actualize();
        }
        if (typeof type == 'object') {
            super.on(type, listener !== undefined ? listener : this.context);
        }
        else {
            super.on(type, listener, context !== undefined ? context : this.context);
        }
        this._hasSubscribers = true;
        this._activate(true);
        return this;
    }
    off(type, listener, context) {
        if (this._dependencies !== null) {
            this.actualize();
        }
        if (type) {
            if (typeof type == 'object') {
                super.off(type, listener !== undefined ? listener : this.context);
            }
            else {
                super.off(type, listener, context !== undefined ? context : this.context);
            }
        }
        else {
            super.off();
        }
        if (this._hasSubscribers &&
            !this._reactions.length &&
            !this._events.has('change') &&
            !this._events.has('error')) {
            this._hasSubscribers = false;
            this._deactivate();
            if (this._reap) {
                this._reap.call(this.context);
            }
        }
        return this;
    }
    _addReaction(reaction, actual) {
        this._reactions.push(reaction);
        this._hasSubscribers = true;
        this._activate(actual);
    }
    _deleteReaction(reaction) {
        this._reactions.splice(this._reactions.indexOf(reaction), 1);
        if (this._hasSubscribers &&
            !this._reactions.length &&
            !this._events.has('change') &&
            !this._events.has('error')) {
            this._hasSubscribers = false;
            this._deactivate();
            if (this._reap) {
                this._reap.call(this.context);
            }
        }
    }
    _activate(actual) {
        if (this._active || !this._pull) {
            return;
        }
        let deps = this._dependencies;
        if (deps) {
            let i = deps.length;
            do {
                deps[--i]._addReaction(this, actual);
            } while (i);
            if (actual) {
                this._state = 'actual';
            }
            this._active = true;
        }
    }
    _deactivate() {
        if (!this._active) {
            return;
        }
        let deps = this._dependencies;
        let i = deps.length;
        do {
            deps[--i]._deleteReaction(this);
        } while (i);
        this._state = 'dirty';
        this._active = false;
    }
    _onValueChange(evt) {
        this._inited = true;
        this._updationId = ++lastUpdationId;
        let reactions = this._reactions;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < reactions.length; i++) {
            reactions[i]._addToRelease(true);
        }
        this.handleEvent(evt);
    }
    _addToRelease(dirty) {
        this._state = dirty ? 'dirty' : 'check';
        let reactions = this._reactions;
        let i = reactions.length;
        if (i) {
            do {
                if (reactions[--i]._state == 'actual') {
                    reactions[i]._addToRelease(false);
                }
            } while (i);
        }
        else if (pendingCells.push(this) == 1) {
            next_tick_1.nextTick(release);
        }
    }
    actualize() {
        if (this._state == 'dirty') {
            this.pull();
        }
        else if (this._state == 'check') {
            let deps = this._dependencies;
            for (let i = 0;;) {
                deps[i].actualize();
                if (this._state == 'dirty') {
                    this.pull();
                    break;
                }
                if (++i == deps.length) {
                    this._state = 'actual';
                    break;
                }
            }
        }
    }
    get() {
        if (this._state != 'actual' && this._updationId != lastUpdationId) {
            this.actualize();
        }
        if (currentCell) {
            if (currentCell._dependencies) {
                if (currentCell._dependencies.indexOf(this) == -1) {
                    currentCell._dependencies.push(this);
                }
            }
            else {
                currentCell._dependencies = [this];
            }
            if (this._error && this._error instanceof WaitError_1.WaitError) {
                throw this._error;
            }
        }
        return this._get ? this._get(this._value) : this._value;
    }
    pull() {
        if (!this._pull) {
            return false;
        }
        if (this._currentlyPulling) {
            throw new TypeError('Circular pulling detected');
        }
        this._currentlyPulling = true;
        let prevDeps = this._dependencies;
        this._dependencies = null;
        let prevCell = currentCell;
        currentCell = this;
        let value;
        try {
            value = this._pull.length
                ? this._pull.call(this.context, this, this._value)
                : this._pull.call(this.context);
        }
        catch (err) {
            $error.error = err;
            value = $error;
        }
        currentCell = prevCell;
        this._currentlyPulling = false;
        if (this._hasSubscribers) {
            let deps = this._dependencies;
            let newDepCount = 0;
            if (deps) {
                let i = deps.length;
                do {
                    let dep = deps[--i];
                    if (!prevDeps || prevDeps.indexOf(dep) == -1) {
                        dep._addReaction(this, false);
                        newDepCount++;
                    }
                } while (i);
            }
            if (prevDeps && (!deps || deps.length - newDepCount < prevDeps.length)) {
                for (let i = prevDeps.length; i;) {
                    i--;
                    if (!deps || deps.indexOf(prevDeps[i]) == -1) {
                        prevDeps[i]._deleteReaction(this);
                    }
                }
            }
            if (deps) {
                this._active = true;
            }
            else {
                this._state = 'actual';
                this._active = false;
            }
        }
        else {
            this._state = this._dependencies ? 'dirty' : 'actual';
        }
        return value === $error ? this.fail($error.error) : this.push(value);
    }
    set(value) {
        if (!this._inited) {
            // Не инициализированная ячейка не может иметь _state == 'check', поэтому вместо
            // actualize сразу pull.
            this.pull();
        }
        if (this._validate) {
            this._validate(value, this._value);
        }
        if (this._merge) {
            value = this._merge(value, this._value);
        }
        if (this._put.length >= 3) {
            this._put.call(this.context, this, value, this._value);
        }
        else {
            this._put.call(this.context, this, value);
        }
        return this;
    }
    push(value) {
        this._inited = true;
        if (this._error) {
            this._setError(null);
        }
        let prevValue = this._value;
        let changed = !Object.is(value, prevValue);
        if (changed) {
            this._value = value;
            if (prevValue instanceof EventEmitter_1.EventEmitter) {
                prevValue.off('change', this._onValueChange, this);
            }
            if (value instanceof EventEmitter_1.EventEmitter) {
                value.on('change', this._onValueChange, this);
            }
        }
        if (this._active) {
            this._state = 'actual';
        }
        this._updationId = ++lastUpdationId;
        if (changed) {
            let reactions = this._reactions;
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < reactions.length; i++) {
                reactions[i]._addToRelease(true);
            }
            this.emit('change', {
                prevValue,
                value
            });
        }
        return changed;
    }
    fail(err) {
        this._inited = true;
        let isWaitError = err instanceof WaitError_1.WaitError;
        if (!isWaitError) {
            if (this.debugKey) {
                logger_1.error('[' + this.debugKey + ']', err);
            }
            else {
                logger_1.error(err);
            }
            if (!(err instanceof Error)) {
                err = new Error(String(err));
            }
        }
        this._setError(err);
        if (this._active) {
            this._state = 'actual';
        }
        return isWaitError;
    }
    _setError(err) {
        this._error = err;
        this._updationId = ++lastUpdationId;
        if (err) {
            this._handleErrorEvent({
                target: this,
                type: 'error',
                data: {
                    error: err
                }
            });
        }
    }
    _handleErrorEvent(evt) {
        if (this._lastErrorEvent === evt) {
            return;
        }
        this._lastErrorEvent = evt;
        this.handleEvent(evt);
        let reactions = this._reactions;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < reactions.length; i++) {
            reactions[i]._handleErrorEvent(evt);
        }
    }
    wait() {
        throw new WaitError_1.WaitError();
    }
    reap() {
        this.off();
        let reactions = this._reactions;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < reactions.length; i++) {
            reactions[i].reap();
        }
        return this;
    }
    dispose() {
        return this.reap();
    }
}
exports.Cell = Cell;
