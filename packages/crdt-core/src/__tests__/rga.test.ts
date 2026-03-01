import { RGA } from '../rga';

describe('RGA CRDT', () => {
    let docA: RGA;
    let docB: RGA;

    beforeEach(() => {
        docA = new RGA('siteA');
        docB = new RGA('siteB');
    });

    test('Basic insert and delete locally', () => {
        docA.localInsert(0, 'H');
        docA.localInsert(1, 'i');
        expect(docA.getText()).toBe('Hi');

        docA.localDelete(0);
        expect(docA.getText()).toBe('i');
    });

    test('Sync single operation', () => {
        const op1 = docA.localInsert(0, 'A');
        docB.applyRemote(op1);
        expect(docB.getText()).toBe('A');
        expect(docA.getText()).toEqual(docB.getText());
    });

    test('Concurrent inserts at the same position', () => {
        const opA = docA.localInsert(0, 'x'); // siteA
        const opB = docB.localInsert(0, 'y'); // siteB

        docA.applyRemote(opB);
        docB.applyRemote(opA);

        expect(docA.getText()).toEqual(docB.getText());
        expect(docA.getText().length).toBe(2);
    });

    test('Concurrent deletes of the same character', () => {
        const op1 = docA.localInsert(0, 'A');
        docB.applyRemote(op1);

        const delA = docA.localDelete(0);
        const delB = docB.localDelete(0);

        docA.applyRemote(delB);
        docB.applyRemote(delA);

        expect(docA.getText()).toBe('');
        expect(docB.getText()).toBe('');
    });

    test('Insert-delete conflicts', () => {
        const op1 = docA.localInsert(0, 'A');
        docB.applyRemote(op1);

        // A deletes 'A'
        const delA = docA.localDelete(0);

        // B inserts 'B' after 'A'
        const opB = docB.localInsert(1, 'B');

        docA.applyRemote(opB);
        docB.applyRemote(delA);

        expect(docB.getText()).toBe('B');
        expect(docA.getText()).toBe('B');
    });

    test('Convergence: two replicas applying ops in different orders produce identical text', () => {
        const rga1 = new RGA('site1');
        const rga2 = new RGA('site2');

        const op1 = rga1.localInsert(0, 'H');
        const op2 = rga1.localInsert(1, 'e');
        const op3 = rga1.localInsert(2, 'l');

        // rga2 inserts '!' at 0 conceptually at the same time
        const op4 = rga2.localInsert(0, '!');

        // Distribute ops in different orders
        // rga1 receives op4 at the end
        rga1.applyRemote(op4);

        // rga2 receives ops causally
        rga2.applyRemote(op1);
        rga2.applyRemote(op2);
        rga2.applyRemote(op3);

        expect(rga1.getText()).toBe(rga2.getText());
    });

    test('Out-of-order insert dependencies are queued and resolved', () => {
        const op1 = docA.localInsert(0, 'A'); // child of root
        const op2 = docA.localInsert(1, 'B'); // child of op1

        // applying op2 before op1 shouldn't throw, and text should be empty because A is missing
        docB.applyRemote(op2);
        expect(docB.getText()).toBe('');

        // applying op1 should resolve op2 from backlog
        docB.applyRemote(op1);
        expect(docB.getText()).toBe('AB');
    });

    test('Delete applied before insert correctly tombstones character upon insertion', () => {
        const op1 = docA.localInsert(0, 'X');
        const delOp1 = docA.localDelete(0);

        // B applies delete for 'X' before getting the insert for 'X'
        docB.applyRemote(delOp1);

        // B applies insert for 'X'
        docB.applyRemote(op1);

        // 'X' should be tombstoned immediately upon insertion
        expect(docB.getText()).toBe('');
    });
});
