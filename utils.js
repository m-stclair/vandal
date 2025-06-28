/**
* @param {string} id
* @returns {HTMLElement}
*/
const gid = (id) => document.getElementById(id)

/**
 * @param {string} name
 * @returns {NodeListOf<HTMLElement>}
 */
const gen = (name) => document.getElementsByName(name)

/**
 * @param {*} obj
 * @returns {Array|*[]}
 */
const listify = function(obj) {
    if (obj instanceof Array) {
        return obj
    }
    return [obj]
}

export {gid, gen}
