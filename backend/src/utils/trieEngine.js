class TrieNode {
    constructor() {
        this.children = {};
        this.isEnd = false;
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word) {
        let node = this.root;
        for (const char of word.toLowerCase()) {
            if (!node.children[char]) node.children[char] = new TrieNode();
            node = node.children[char];
        }
        node.isEnd = true;
    }

    search(prefix) {
        let node = this.root;
        for (const char of prefix.toLowerCase()) {
            if (!node.children[char]) return [];
            node = node.children[char];
        }
        const results = [];
        this._dfs(node, prefix.toLowerCase(), results);
        return results.slice(0, 10);
    }

    _dfs(node, current, results) {
        if (node.isEnd) results.push(current);
        for (const [char, child] of Object.entries(node.children)) {
            this._dfs(child, current + char, results);
        }
    }
}

const SKILL_DICT = [
    'react','react native','redux','node.js','express','mongodb','mongoose',
    'redis','playwright','javascript','typescript','python','django','flask',
    'kubernetes','docker','java','spring boot','c++','c','rust','golang',
    'aws','gcp','azure','sql','postgresql','mysql','graphql','rest api',
    'dsa','data structures','algorithms','system design','machine learning',
    'deep learning','tensorflow','pytorch','scikit-learn','pandas','numpy',
    'kafka','rabbitmq','elasticsearch','tailwind css','next.js','vue.js',
    'angular','flutter','swift','kotlin','android','ios','git','linux'
];

const trie = new Trie();
SKILL_DICT.forEach(skill => trie.insert(skill));

export { trie };
