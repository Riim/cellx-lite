import ErrorLogger from './ErrorLogger';
import EventEmitter from './EventEmitter';
import ObservableCollectionMixin from './Collections/ObservableCollectionMixin';
import ObservableMap from './Collections/ObservableMap';
import ObservableList from './Collections/ObservableList';
import Cell from './Cell';
import { UID as KEY_UID, CELLS as KEY_CELLS } from './keys';
import { is } from './JS/Object';
import Map from './JS/Map';
import Symbol from './JS/Symbol';
import logError from './Utils/logError';
import nextUID from './Utils/nextUID';
import mixin from './Utils/mixin';
import createClass from './Utils/createClass';
import nextTick from './Utils/nextTick';
import noop from './Utils/noop';

ErrorLogger.setHandler(logError);

var cellx = {};

cellx.ErrorLogger = ErrorLogger;
cellx.EventEmitter = EventEmitter;
cellx.ObservableCollectionMixin = ObservableCollectionMixin;
cellx.ObservableMap = ObservableMap;
cellx.ObservableList = ObservableList;
cellx.Cell = Cell;
cellx.autorun = Cell.autorun;
cellx.transact = cellx.transaction = Cell.transaction;
cellx.KEY_UID = KEY_UID;
cellx.KEY_CELLS = KEY_CELLS;

/**
 * @typesign (obj: cellx.EventEmitter, name: string, value) -> cellx.EventEmitter;
 */
function defineObservableProperty(obj, name, value) {
	var privateName = '_' + name;

	obj[privateName] = value instanceof Cell ? value : new Cell(value, { owner: obj });

	Object.defineProperty(obj, name, {
		configurable: true,
		enumerable: true,

		get: function() {
			return this[privateName].get();
		},

		set: function(value) {
			this[privateName].set(value);
		}
	});

	return obj;
}

cellx.defineObservableProperty = defineObservableProperty;

/**
 * @typesign (obj: cellx.EventEmitter, props: Object) -> cellx.EventEmitter;
 */
function defineObservableProperties(obj, props) {
	Object.keys(props).forEach(function(name) {
		defineObservableProperty(obj, name, props[name]);
	});

	return obj;
}

cellx.defineObservableProperties = defineObservableProperties;

/**
 * @typesign (obj: cellx.EventEmitter, name: string, value) -> cellx.EventEmitter;
 * @typesign (obj: cellx.EventEmitter, props: Object) -> cellx.EventEmitter;
 */
function define(obj, name, value) {
	if (arguments.length == 3) {
		defineObservableProperty(obj, name, value);
	} else {
		defineObservableProperties(obj, name);
	}

	return obj;
}

cellx.define = define;

cellx.JS = cellx.js = {
	is,
	Symbol,
	Map
};

cellx.Utils = cellx.utils = {
	logError,
	nextUID,
	mixin,
	createClass,
	nextTick,
	noop
};

cellx.cellx = cellx;

cellx.__esModule = true;
cellx.default = cellx;

export default cellx;
