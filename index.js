const Decimal = require('decimal.js');
const nodes = require('./mixnode.json')
const reward_params = require('./reward_params.json')
const current = require('./current.json')

function node_reward(self, reward_params, node_params) {
    let work
    if (node_params.in_active_set) {
        work = active_node_work(reward_params)
    } else {
        work = standby_node_work(reward_params)
    }

    let alpha = new Decimal(reward_params.interval.sybil_resistance)


    const result = new Decimal(reward_params.interval.epoch_reward_budget)
        .mul(node_params.performance)
        .mul(bond_saturation(self, reward_params))
        .mul(
            work
                .add(
                    alpha
                        .mul(pledge_saturation(self, reward_params))
                        .div(new Decimal(reward_params.rewarded_set_size))
                )
        )
        .div(new Decimal(1).add(alpha))
    return result
}


function active_node_work(reward_params) {
    return new Decimal(reward_params.interval.active_set_work_factor).mul(standby_node_work(reward_params))
}

function standby_node_work(reward_params) {
    const f = new Decimal(reward_params.interval.active_set_work_factor)
    const k = new Decimal(reward_params.rewarded_set_size)
    const one = new Decimal(1)
    const k_r = k.sub(new Decimal(reward_params.active_set_size))
    return one.div(f.mul(k).sub(f.sub(one).mul(k_r)))
}

function bond_saturation(self, reward_params) {
    if (node_bond(self).greaterThan(new Decimal(reward_params.interval.stake_saturation_point))) {
        return new Decimal(1)
    } else {
        return node_bond(self).div(new Decimal(reward_params.interval.stake_saturation_point))
    }
}

function node_bond(self) {
    return new Decimal(self.operator).add(new Decimal(self.delegates))
}


function pledge_saturation(self, reward_params) {
    if (new Decimal(self.operator).greaterThan(new Decimal(reward_params.interval.stake_saturation_point))) {
        return new Decimal(1)
    } else {
        return new Decimal(self.operator).div(new Decimal(reward_params.interval.stake_saturation_point))
    }
}

const epochs_in_interval = new Decimal(current.epochs_in_interval)
function node_cost(node_params) {
    return new Decimal(node_params.mixnode_details.rewarding_details.cost_params.interval_operating_cost.amount).div(epochs_in_interval).mul(node_params.performance)
}

function determine_reward_split(self, node_reward, performance) {
    const node_cost = new Decimal(self.cost_params.interval_operating_cost.amount).div(epochs_in_interval).mul(performance)
    if (node_reward.greaterThan(node_cost)) {
        let profit = node_reward.sub(node_cost);
        let profit_margin = new Decimal(self.cost_params.profit_margin_percent);
        let one = new Decimal(1)

        let operator_share = new Decimal(self.operator).div(node_bond(self));

        let operator = profit.mul(profit_margin.add(one.sub(profit_margin).mul(operator_share)));
        if (this.mix_id == 264) {
            console.log(operator)
        }
        let delegates = profit.sub(operator);
        return {
            operator: operator.add(node_cost),
            delegates,
        }
    } else {
        return {
            operator: node_reward,
            delegates: new Decimal(0),
        }
    }
}

const node_rewards = nodes.map(node_params => {
    if (!node_params) {
        return
    }
    const total_node_reward = node_reward(
        node_params.mixnode_details.rewarding_details,
        reward_params,
        {
            performance: new Decimal(node_params.performance),
            in_active_set: true,
            mix_id: node_params.mixnode_details.bond_information.mix_id
        }
    )
    const cost = node_cost(node_params, reward_params.interval)
    const reward_distribution = determine_reward_split.bind(node_params.mixnode_details.bond_information)(
        node_params.mixnode_details.rewarding_details,
        total_node_reward,
        new Decimal(node_params.performance)
    )
    const delegates = new Decimal(node_params.mixnode_details.rewarding_details.delegates)

    return {
        mix_id: node_params.mixnode_details.bond_information.mix_id,
        total_node_reward,
        operating_cost: cost,
        ...reward_distribution,
        APY: delegates.equals(0) ? 0 : reward_distribution.delegates.div(delegates).mul(365 * 24).mul(100)
    }
})

console.log(JSON.stringify(node_rewards, null, 2))
