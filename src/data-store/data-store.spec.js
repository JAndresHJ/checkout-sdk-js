import { Observable } from 'rxjs';
import DataStore from './data-store';

describe('DataStore', () => {
    describe('#dispatch()', () => {
        it('dispatches actions to reducers', () => {
            const state = {};
            const reducer = jest.fn(() => state);
            const store = new DataStore(reducer, state);
            const action = { type: 'ACTION' };

            store.dispatch(action);

            expect(reducer).toHaveBeenCalledWith(state, action);
        });

        it('subscribes to observables and dispatches actions to reducers', async () => {
            const state = {};
            const reducer = jest.fn(() => state);
            const store = new DataStore(reducer, state);
            const action = Observable.from([
                { type: 'ACTION' },
                { type: 'ACTION_2' },
            ]);

            await store.dispatch(action);

            expect(reducer).toHaveBeenCalledWith(state, { type: 'ACTION' });
            expect(reducer).toHaveBeenCalledWith(state, { type: 'ACTION_2' });
        });

        it('dispatches observable actions and resolves promise with current state', async () => {
            const store = new DataStore((state, action) => {
                if (action.type === 'APPEND') {
                    return { ...state, message: state.message + action.payload };
                }

                return state;
            }, { message: '' });

            expect(await store.dispatch(Observable.of(
                { type: 'APPEND', payload: 'foo' },
                { type: 'APPEND', payload: 'bar' },
                { type: 'APPEND', payload: '!!!' },
            ))).toEqual({ message: 'foobar!!!' });
        });

        it('dispatches observable actions and rejects promise with current state', async () => {
            const store = new DataStore(state => state, { message: 'foobar' });

            try {
                await store.dispatch(Observable.throw({ type: 'APPEND_ERROR' }));
            } catch (error) {
                expect(error).toEqual({ message: 'foobar' });
            }
        });

        it('dispatches observable actions sequentially', async () => {
            const reducer = jest.fn(state => state);
            const store = new DataStore(reducer);

            reducer.mockClear();

            await Promise.all([
                store.dispatch(Observable.of({ type: 'ACTION' }).delay(10)),
                store.dispatch(Observable.of({ type: 'ACTION_2' })),
                store.dispatch(Observable.throw({ type: 'ACTION_3', error: true })).catch(() => {}),
                store.dispatch(Observable.of({ type: 'ACTION_4' })),
            ]);

            expect(reducer.mock.calls).toEqual([
                [expect.anything(), { type: 'ACTION' }],
                [expect.anything(), { type: 'ACTION_2' }],
                [expect.anything(), { type: 'ACTION_3', error: true }],
                [expect.anything(), { type: 'ACTION_4' }],
            ]);
        });

        it('dispatches observable actions sequentially by tags', async () => {
            const reducer = jest.fn(state => state);
            const store = new DataStore(reducer);

            reducer.mockClear();

            await Promise.all([
                store.dispatch(Observable.of({ type: 'ACTION' }).delay(10)),
                store.dispatch(Observable.of({ type: 'ACTION_2' })),
                store.dispatch(Observable.throw({ type: 'ACTION_3', error: true })).catch(() => {}),
                store.dispatch(Observable.of({ type: 'FOOBAR_ACTION' }).delay(5), { queueId: 'foobar' }),
                store.dispatch(Observable.of({ type: 'FOOBAR_ACTION_2' }), { queueId: 'foobar' }),
                store.dispatch(Observable.of({ type: 'ACTION_4' })),
            ]);

            expect(reducer.mock.calls).toEqual([
                [expect.anything(), { type: 'FOOBAR_ACTION' }],
                [expect.anything(), { type: 'FOOBAR_ACTION_2' }],
                [expect.anything(), { type: 'ACTION' }],
                [expect.anything(), { type: 'ACTION_2' }],
                [expect.anything(), { type: 'ACTION_3', error: true }],
                [expect.anything(), { type: 'ACTION_4' }],
            ]);
        });

        it('resolves promises sequentially', async () => {
            const store = new DataStore(state => state);
            const callback = jest.fn();

            await Promise.all([
                store.dispatch(Observable.of({ type: 'ACTION' }).delay(10)).then(() => callback('ACTION')),
                store.dispatch(Observable.of({ type: 'ACTION_2' })).then(() => callback('ACTION_2')),
                store.dispatch(Observable.throw({ type: 'ACTION_3', error: true })).catch(() => callback('ACTION_3')),
                store.dispatch(Observable.of({ type: 'FOOBAR_ACTION' }).delay(5), { queueId: 'foobar' }).then(() => callback('FOOBAR_ACTION')),
                store.dispatch(Observable.of({ type: 'FOOBAR_ACTION_2' }), { queueId: 'foobar' }).then(() => callback('FOOBAR_ACTION_2')),
                store.dispatch(Observable.of({ type: 'ACTION_4' })).then(() => callback('ACTION_4')),
            ]);

            expect(callback.mock.calls).toEqual([
                ['FOOBAR_ACTION'],
                ['FOOBAR_ACTION_2'],
                ['ACTION'],
                ['ACTION_2'],
                ['ACTION_3'],
                ['ACTION_4'],
            ]);
        });

        it('ignores actions that do not have `type` property', () => {
            const reducer = jest.fn(state => state);
            const store = new DataStore(reducer);

            reducer.mockClear();
            store.dispatch({});
            store.dispatch({ payload: 'foobar' });

            expect(reducer).not.toHaveBeenCalled();
        });

        it('ignores observable actions that do not emit actions with `type` property', () => {
            const reducer = jest.fn(state => state);
            const store = new DataStore(reducer);

            reducer.mockClear();
            store.dispatch(Observable.of({}, { payload: 'foobar' }));

            expect(reducer).not.toHaveBeenCalled();
        });
    });

    describe('#subscribe()', () => {
        it('notifies subscribers when dispatching actions', () => {
            const initialState = { foobar: 'foobar' };
            const store = new DataStore(state => state, initialState);
            const subscriber = jest.fn();

            store.subscribe(subscriber);
            store.dispatch({ type: 'ACTION' });

            expect(subscriber).toHaveBeenCalledWith(initialState);
        });

        it('does not notify subscribers if the current state has not changed', () => {
            const initialState = { foobar: 'foobar' };
            const store = new DataStore(
                (state, action) => action.type === 'CAPITALIZE' ? { foobar: 'FOOBAR' } : state,
                initialState
            );
            const subscriber = jest.fn();

            store.subscribe(subscriber);
            subscriber.mockReset();
            store.dispatch({ type: 'CAPITALIZE' });
            store.dispatch({ type: 'ACTION' });

            expect(subscriber.mock.calls.length).toEqual(1);
        });

        it('does not notify subscribers if current state has changed in reference but not value', () => {
            const store = new DataStore(
                (state) => ({ ...state }),
                { foobar: 'foobar' }
            );

            const subscriber = jest.fn();

            store.subscribe(subscriber);
            store.dispatch({ type: 'ACTION' });

            expect(subscriber.mock.calls.length).toEqual(1);
        });

        it('notifies subscribers with the tranformed state', () => {
            const initialState = { foobar: 'foobar' };
            const store = new DataStore(
                (state, action) => action.type === 'CAPITALIZE' ? { foobar: 'FOOBAR' } : state,
                initialState,
                (state) => ({ ...state, transformed: true })
            );
            const subscriber = jest.fn();

            store.subscribe(subscriber);
            store.dispatch({ type: 'CAPITALIZE' });

            expect(subscriber).toHaveBeenCalledWith({
                foobar: 'FOOBAR',
                transformed: true,
            });
        });

        it('notifies all subscribers with the initial state', () => {
            const store = new DataStore(state => state);
            const subscriber = jest.fn();

            store.subscribe(subscriber);

            expect(subscriber).toHaveBeenCalledWith(store.getState());
        });

        it('only notifies subscribers when `filter` condition is met', () => {
            const store = new DataStore((state, action) => {
                switch (action.type) {
                case 'FOO':
                    return { ...state, foo: 'foo' };

                case 'FOO_CAPITALIZED':
                    return { ...state, foo: 'FOO' };

                case 'BAR':
                    return { ...state, bar: 'bar' };

                default:
                    return state;
                }
            });
            const subscriber = jest.fn();

            store.subscribe(subscriber, (state) => state.foo);
            subscriber.mockReset();

            store.dispatch({ type: 'FOO' });
            store.dispatch({ type: 'FOO' });
            store.dispatch({ type: 'BAR' });
            store.dispatch({ type: 'FOO_CAPITALIZED' });
            store.dispatch({ type: 'FOO' });

            expect(subscriber).toHaveBeenCalledTimes(3);
        });

        it('only notifies subscribers when multiple `filter` conditions are met', () => {
            const store = new DataStore((state, action) => {
                switch (action.type) {
                case 'FOO':
                    return { ...state, foo: 'foo' };

                case 'BAR':
                    return { ...state, bar: 'bar' };

                case 'FOOBAR':
                    return { ...state, foobar: 'foobar' };

                case 'FOO_AND_BAR':
                    return { ...state, foo: 'FOO', bar: 'BAR' };

                default:
                    return state;
                }
            });
            const subscriber = jest.fn();

            store.subscribe(
                subscriber,
                (state) => state.foo,
                (state) => state.bar
            );
            subscriber.mockReset();

            store.dispatch({ type: 'FOO' });
            store.dispatch({ type: 'FOO' });
            store.dispatch({ type: 'BAR' });
            store.dispatch({ type: 'FOOBAR' });
            store.dispatch({ type: 'FOOBAR' });
            store.dispatch({ type: 'FOO_AND_BAR' });

            expect(subscriber).toHaveBeenCalledTimes(3);
        });

        it('notifies subscribers sequentially', async () => {
            const store = new DataStore((state, action) => {
                if (action.type === 'APPEND') {
                    return { ...state, message: `${state.message}${action.payload}` };
                }

                return state;
            }, { message: '' });
            const subscriber = jest.fn();

            store.subscribe(subscriber);

            await Promise.all([
                store.dispatch(Observable.from([{ type: 'APPEND', payload: 'foo' }, { type: 'APPEND', payload: 'bar' }]).delay(10)),
                store.dispatch(Observable.from([{ type: 'APPEND', payload: '!!!' }]).delay(1)),
            ]);

            expect(subscriber.mock.calls).toEqual([
                [{ message: '' }],
                [{ message: 'foo' }],
                [{ message: 'foobar' }],
                [{ message: 'foobar!!!' }],
            ]);
        });

        it('notifies subscribers sequentially by tags', async () => {
            const store = new DataStore((state, action) => {
                if (action.type === 'APPEND') {
                    return { ...state, message: `${state.message}${action.payload}` };
                }

                return state;
            }, { message: '' });
            const subscriber = jest.fn();

            store.subscribe(subscriber);

            await Promise.all([
                store.dispatch(Observable.from([{ type: 'APPEND', payload: 'foo' }, { type: 'APPEND', payload: 'bar' }]).delay(10)),
                store.dispatch(Observable.from([{ type: 'APPEND', payload: '!!!' }]).delay(5)),
                store.dispatch(Observable.from([{ type: 'APPEND', payload: 'Hey' }]).delay(1), { queueId: 'greeting' }),
                store.dispatch(Observable.from([{ type: 'APPEND', payload: ', ' }]), { queueId: 'greeting' }),
            ]);

            expect(subscriber.mock.calls).toEqual([
                [{ message: '' }],
                [{ message: 'Hey' }],
                [{ message: 'Hey, ' }],
                [{ message: 'Hey, foo' }],
                [{ message: 'Hey, foobar' }],
                [{ message: 'Hey, foobar!!!' }],
            ]);
        });

        it('calls the reducer with the initial action', () => {
            const initialState = { foobar: 'foobar' };
            const reducer = jest.fn(state => state);
            const store = new DataStore(reducer, initialState);

            store.subscribe(() => {});

            expect(reducer).toHaveBeenCalledWith(initialState, { type: 'INIT' });
        });

        it('returns an unsubscribe function', () => {
            const initialState = { foobar: 'foobar' };
            const store = new DataStore(state => state, initialState);
            const subscriber = jest.fn();
            const unsubscribe = store.subscribe(subscriber);

            unsubscribe();
            subscriber.mockReset();
            store.dispatch({ type: 'ACTION' });

            expect(subscriber).not.toHaveBeenCalledWith(initialState);
        });
    });

    describe('#notifyState()', () => {
        it('notifies subscribers of its current state', () => {
            const store = new DataStore(state => state, { foobar: 'foobar' });
            const subscriber = jest.fn();

            store.subscribe(subscriber);
            store.notifyState();

            expect(subscriber).toHaveBeenLastCalledWith({ foobar: 'foobar' });
            expect(subscriber).toHaveBeenCalledTimes(2);
        });

        it('notifies subscribers with filters of its current state', () => {
            const store = new DataStore(state => state, { foobar: 'foobar' });
            const subscriber = jest.fn();

            store.subscribe(subscriber, (state) => state.foobar);
            store.notifyState();

            expect(subscriber).toHaveBeenLastCalledWith({ foobar: 'foobar' });
            expect(subscriber).toHaveBeenCalledTimes(2);
        });
    });

    describe('#getState()', () => {
        it('returns the current state', () => {
            const initialState = { foobar: 'foobar' };
            const store = new DataStore((state, action) => {
                if (action.type === 'INCREMENT') {
                    return { foobar: 'foobar x2' };
                }

                return state;
            }, initialState);

            expect(store.getState()).toEqual(initialState);

            store.dispatch({ type: 'INCREMENT' });

            expect(store.getState()).toEqual({ foobar: 'foobar x2' });
        });

        it('does not return different reference if values are equal after reduction', () => {
            const store = new DataStore(
                (state) => ({ ...state }),
                { foobar: 'foobar' }
            );

            const oldState = store.getState();

            store.dispatch({ type: 'ACTION' });

            expect(store.getState()).toBe(oldState);
        });

        it('applies the state transformer before returning the current state', () => {
            const store = new DataStore(
                (state, action) => action.type === 'INCREMENT' ? { foobar: 'foobar x2' } : state,
                { foobar: 'foobar' },
                (state) => ({ ...state, transformed: true })
            );

            expect(store.getState()).toEqual({
                foobar: 'foobar',
                transformed: true,
            });

            store.dispatch({ type: 'INCREMENT' });

            expect(store.getState()).toEqual({
                foobar: 'foobar x2',
                transformed: true,
            });
        });
    });
});