import Cell from './Cell';
import ObservableCollectionMixin from './Collections/ObservableCollectionMixin';
import ObservableList from './Collections/ObservableList';
import ObservableMap from './Collections/ObservableMap';
import ErrorLogger from './ErrorLogger';
import EventEmitter from './EventEmitter';
import Map from './JS/Map';
import { is } from './JS/Object';
import Symbol from './JS/Symbol';
import { CELLS as KEY_CELLS, UID as KEY_UID } from './keys';
import logError from './Utils/logError';
import mixin from './Utils/mixin';
import nextTick from './Utils/nextTick';
import nextUID from './Utils/nextUID';
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
	var cellName = name + 'Cell';

	obj[cellName] = value instanceof Cell ? value : new Cell(value, { owner: obj });

	Object.defineProperty(obj, name, {
		configurable: true,
		enumerable: true,

		get: function() {
			return this[cellName].get();
		},

		set: function(value) {
			this[cellName].set(value);
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
	if (typeof name == 'string') {
		defineObservableProperty(obj, name, value);
	} else {
		defineObservableProperties(obj, name);
	}

	return obj;
}

cellx.define = define;

cellx.JS = {
	is,
	Symbol,
	Map
};

cellx.Utils = {
	logError,
	nextUID,
	mixin,
	nextTick,
	noop
};

cellx.cellx = cellx;

cellx.__esModule = true;
cellx.default = cellx;

export default cellx;
